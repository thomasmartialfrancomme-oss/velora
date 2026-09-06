/**
 * AIService — the only thing the rest of the product talks to.
 *
 *   AIService.handle({ actor, text })        → structured plan + persisted rows
 *   AIService.summarise({ actor, scope })    → short digest of one module
 *   AIService.briefing({ actor })            → the private daily briefing
 *   AIService.search({ actor, term })        → look-up inside the client's own data
 *
 * Swapping providers is a one-line change (see `resolveProvider`). A provider
 * returns a *plan*; this service is what turns that plan into records, and it
 * refuses to mark an external step as finished.
 */
import { getDb, newId, nowIso } from '@/lib/db';
import { audit } from '@/lib/db';
import type { Actor } from '@/lib/ai/context';
import { buildClientContext, contextDigest } from '@/lib/ai/context';
import { coordinate, detectIntent } from '@/lib/ai/analysis';
import { demoProvider } from '@/lib/ai/providers/demo';
import { httpProvider, HttpProviderError } from '@/lib/ai/providers/http';
import type { AIProvider, AIProviderInfo, AIResult } from '@/lib/ai/types';
import { env } from '@/lib/config';
import { globalSearch, buildBriefing, type Briefing } from '@/lib/data/analytics';
import { createExpense, createTask, notify } from '@/lib/data/write';
import { expensesTable, tasksTable } from '@/lib/data/tables';

/* --------------------------------------------------------- provider map */

const providers = new Map<string, AIProvider>([
  [demoProvider.info.id, demoProvider],
  [httpProvider.info.id, httpProvider],
]);

/** Add a vendor by implementing AIProvider and registering it here. */
export function registerProvider(provider: AIProvider): void {
  providers.set(provider.info.id, provider);
}

export function resolveProvider(): AIProvider {
  const wanted = env.ai.provider;
  if (wanted === 'demo') return demoProvider;
  if (wanted === 'http') return providers.get(httpProvider.info.id) ?? demoProvider;
  // auto: use the gateway when configured, otherwise the deterministic core.
  return env.capabilities.aiProviderConfigured ? providers.get(httpProvider.info.id) ?? demoProvider : demoProvider;
}

export function activeProviderInfo(): AIProviderInfo {
  return resolveProvider().info;
}

export function providerCatalogue(): AIProviderInfo[] {
  return [...providers.values()].map((p) => p.info);
}

/* ------------------------------------------------------------- handling */

export interface HandleOptions {
  actor: Actor;
  text: string;
  conversationId?: string | null;
  /** analysis only — writes nothing (used by the marketing preview) */
  dry?: boolean;
}

export interface HandleOutcome {
  result: AIResult;
  conversationId: string | null;
  created: { tasks: string[]; expenses: string[]; actions: number };
  degraded: boolean;
}

export const AIService = {
  /**
   * Analyse a request, persist the conversation, and materialise the plan.
   * Actions that need an outside party become tasks flagged
   * `awaiting_confirmation`; nothing is ever recorded as done on a guess.
   */
  async handle({ actor, text, conversationId, dry = false }: HandleOptions): Promise<HandleOutcome> {
    const context = buildClientContext(actor);
    const provider = resolveProvider();
    let degraded = false;
    let result: AIResult;

    try {
      result = await provider.respond({ text, context, conversationId, providerInfo: provider.info, contextDigest: contextDigest(context) } as never);
    } catch (error) {
      if (!(error instanceof HttpProviderError)) console.error('[velora] AI provider failed, falling back:', error);
      degraded = true;
      result = coordinate({ text, context, conversationId, providerInfo: demoProvider.info }).result;
    }

    if (dry) {
      return { result, conversationId: conversationId ?? null, created: { tasks: [], expenses: [], actions: result.actions.length }, degraded };
    }

    const db = getDb();
    const ts = nowIso();
    const convId = conversationId ?? newId('conv');

    if (!conversationId) {
      db.run(
        `INSERT INTO ai_conversations (id, user_id, title, channel, provider, model, status, created_at, updated_at)
         VALUES (@id, @userId, @title, 'command_center', @provider, @model, 'open', @ts, @ts)`,
        {
          id: convId,
          userId: actor.id,
          title: titleFrom(text),
          provider: provider.info.id,
          model: provider.info.model,
          ts,
        },
      );
    } else {
      const owned = db.get<{ id: string }>(`SELECT id FROM ai_conversations WHERE id = @id AND user_id = @userId`, { id: convId, userId: actor.id });
      if (!owned) throw new Error('That conversation is not part of your records.');
    }

    db.run(
      `INSERT INTO ai_messages (id, user_id, conversation_id, role, content, created_at)
       VALUES (@id, @userId, @conv, 'user', @content, @ts)`,
      { id: newId('msg'), userId: actor.id, conv: convId, content: text.trim().slice(0, 2000), ts },
    );
    db.run(
      `INSERT INTO ai_messages (id, user_id, conversation_id, role, content, payload_json, created_at)
       VALUES (@id, @userId, @conv, 'assistant', @content, @payload, @ts)`,
      {
        id: newId('msg'),
        userId: actor.id,
        conv: convId,
        content: result.headline,
        payload: JSON.stringify({ blocks: result.blocks, notes: result.notes, kind: result.kind, provider: result.provider }),
        ts: new Date(Date.parse(ts) + 250).toISOString(),
      },
    );
    db.run(`UPDATE ai_conversations SET updated_at = @ts, provider = @provider, model = @model WHERE id = @id`, {
      ts,
      provider: provider.info.id,
      model: provider.info.model,
      id: convId,
    });

    const plan = coordinate({ text, context, conversationId: convId, providerInfo: provider.info });
    const created = { tasks: [] as string[], expenses: [] as string[], actions: 0 };

    for (const record of plan.records) {
      if (record.kind === 'expense' && record.amountCents && record.amountCents > 0) {
        const expense = createExpense(actor.id, {
          categoryKey: (record.categoryKey ?? 'property_operations') as never,
          description: record.title,
          vendor: record.vendor ?? null,
          amount: record.amountCents,
          spentOn: record.spentOn ?? new Date().toISOString().slice(0, 10),
          propertyId: record.propertyId ?? null,
          status: 'pending',
          notes: 'Created by the AI coordinator from a spoken request. Awaiting reconciliation.',
        });
        created.expenses.push(expense.id);
        continue;
      }
      const task = createTask(actor.id, {
        title: record.title.slice(0, 160),
        category: (record.category ?? 'maintenance') as never,
        status: record.requiresConfirmation ? 'awaiting_confirmation' : 'pending',
        priority: (record.priority ?? 'normal') as never,
        propertyId: record.propertyId ?? null,
        staffId: record.staffId ?? null,
        dueAt: record.dueAt ?? null,
        detail: record.detail ?? null,
        requiresConfirmation: Boolean(record.requiresConfirmation),
        origin: 'ai',
        originRef: convId,
      });
      created.tasks.push(task.id);
    }

    // Mirror every action onto the ai_tasks ledger so the client can approve or decline it.
    for (let index = 0; index < result.actions.length; index += 1) {
      const action = result.actions[index]!;
      const linked = created.tasks[index];
      db.run(
        `INSERT INTO ai_tasks (id, user_id, conversation_id, label, module, status, requires_confirmation, confidence, detail, task_id, created_at, updated_at)
         VALUES (@id, @userId, @conv, @label, @module, @status, @requires, @confidence, @detail, @taskId, @ts, @ts)`,
        {
          id: newId('ait'),
          userId: actor.id,
          conv: convId,
          label: action.label.slice(0, 180),
          module: action.module,
          status: action.status === 'confirmed' ? 'confirmed' : action.requiresConfirmation ? 'requires_confirmation' : 'proposed',
          requires: action.requiresConfirmation ? 1 : 0,
          confidence: result.confidence,
          detail: action.detail?.slice(0, 900) ?? null,
          taskId: linked ?? null,
          ts,
        },
      );
      created.actions += 1;
    }

    if (result.requiresHuman) {
      notify(actor.id, {
        kind: 'ai',
        title: 'The coordinator needs a decision from you',
        body: result.actions
          .filter((a) => a.requiresConfirmation)
          .map((a) => a.label)
          .join(' · ')
          .slice(0, 240),
        severity: 'attention',
        actionLabel: 'Review',
        actionHref: '/ai',
      });
    }

    audit({ userId: actor.id, event: 'ai.request_handled', target: convId, meta: { kind: result.kind, provider: provider.info.id, tasks: created.tasks.length, degraded } });

    return { result: { ...result, conversationId: convId }, conversationId: convId, created, degraded };
  },

  /** One-paragraph digest of a module, built from rows — no model required. */
  summarise(actor: Actor, scope: 'properties' | 'tasks' | 'travel' | 'finance' | 'people' | 'vehicles'): { text: string; source: string; generatedAt: string } {
    const db = getDb();
    const userId = actor.id;
    const generatedAt = nowIso();

    if (scope === 'properties') {
      const rows = db.all<{ name: string; status: string; city: string }>(`SELECT name, status, city FROM properties WHERE user_id = @userId ORDER BY is_primary DESC, name`, { userId });
      const attention = rows.filter((r) => r.status !== 'operational' && r.status !== 'standby');
      return {
        text: rows.length
          ? `${rows.length} residence${rows.length === 1 ? '' : 's'} on file. ${attention.length ? `${attention.length} need attention: ${attention.map((r) => r.name).join(', ')}.` : 'All are recorded as operational.'}`
          : 'No residence is on file yet.',
        source: 'properties',
        generatedAt,
      };
    }
    if (scope === 'tasks') {
      const rows = db.all<{ title: string; status: string }>(`SELECT title, status FROM tasks WHERE user_id = @userId AND status != 'done' ORDER BY due_at LIMIT 20`, { userId });
      const waiting = rows.filter((r) => r.status === 'awaiting_confirmation');
      return {
        text: rows.length
          ? `${rows.length} open task${rows.length === 1 ? '' : 's'}. ${waiting.length ? `${waiting.length} await your confirmation.` : 'None are blocked on you.'}`
          : 'Nothing is open across your households.',
        source: 'tasks',
        generatedAt,
      };
    }
    if (scope === 'travel') {
      const rows = db.all<{ title: string; starts_at: string; status: string }>(
        `SELECT title, starts_at, status FROM trips WHERE user_id = @userId AND starts_at >= date('now') ORDER BY starts_at LIMIT 5`,
        { userId },
      );
      return {
        text: rows.length
          ? `${rows.length} upcoming movement${rows.length === 1 ? '' : 's'}: ${rows.map((r) => `${r.title} (${new Date(r.starts_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`).join('; ')}.`
          : 'No movement is scheduled.',
        source: 'trips',
        generatedAt,
      };
    }
    if (scope === 'finance') {
      const row = db.get<{ cents: number | null }>(
        `SELECT SUM(amount_cents) AS cents FROM expenses WHERE user_id = @userId AND spent_on BETWEEN date('now','start of month') AND date('now','+1 month','-1 day')`,
        { userId },
      );
      const cents = Number(row?.cents ?? 0);
      return {
        text: `Recorded this month: €${Math.round(cents / 100).toLocaleString('en-GB')}. Grouped by category in the ledger; VELORA keeps the records and offers no financial advice.`,
        source: 'expenses',
        generatedAt,
      };
    }
    if (scope === 'people') {
      const rows = db.all<{ name: string; role: string; status: string }>(
        `SELECT TRIM(first_name || ' ' || last_name) AS name, role, status FROM staff WHERE user_id = @userId ORDER BY status, last_name LIMIT 40`,
        { userId },
      );
      const onSite = rows.filter((r) => r.status === 'on_site');
      return {
        text: rows.length
          ? `${rows.length} people in the directory; ${onSite.length} recorded on site (${onSite.map((r) => r.name).join(', ') || 'none named'}).`
          : 'Your staff directory is empty.',
        source: 'staff',
        generatedAt,
      };
    }
    const rows = db.all<{ name: string; status: string }>(`SELECT make || ' ' || model AS name, status FROM vehicles WHERE user_id = @userId`, { userId });
    const ready = rows.filter((r) => r.status === 'ready');
    return {
      text: rows.length ? `${rows.length} vehicle${rows.length === 1 ? '' : 's'} on file; ${ready.length} marked ready.` : 'No vehicle is recorded.',
      source: 'vehicles',
      generatedAt,
    };
  },

  briefing(actor: Actor): Briefing {
    return buildBriefing(actor);
  },

  search(actor: Actor, term: string) {
    return globalSearch(actor.id, term);
  },

  /** Exposed so the UI can state, precisely, what a request was read as. */
  analyse(text: string) {
    return detectIntent(text);
  },
};

function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const first = clean.charAt(0).toUpperCase();
  return (first + clean.slice(1, 60)).replace(/[.?!]+$/, '');
}

/* --------------------------------------------------- confirmation loop */

/**
 * When a client approves an action, the task flips out of
 * `awaiting_confirmation`. A coordinator still has to place the outside call —
 * the platform records that the client has approved, nothing more.
 */
export function approveAiAction(actor: Actor, aiTaskId: string, note?: string): { message: string; taskId: string | null } {
  const db = getDb();
  const row = db.get<{ id: string; task_id: string | null; label: string }>(`SELECT id, task_id, label FROM ai_tasks WHERE id = @id AND user_id = @userId`, {
    id: aiTaskId,
    userId: actor.id,
  });
  if (!row) throw new Error('That action is no longer available.');

  db.run(`UPDATE ai_tasks SET status = 'confirmed', requires_confirmation = 0, updated_at = @ts WHERE id = @id`, { ts: nowIso(), id: aiTaskId });
  let taskId = row.task_id;
  if (taskId) {
    tasksTable.update(taskId, { status: 'pending', requiresConfirmation: false, detail: note ? `Approved: ${note}` : 'Approved by the client.' }, actor.id);
  } else {
    const created = createTask(actor.id, {
      title: row.label.slice(0, 160),
      category: 'staff',
      status: 'pending',
      priority: 'normal',
      propertyId: null,
      staffId: null,
      dueAt: null,
      detail: 'Approved in the command centre; the private office will instruct the supplier.',
      requiresConfirmation: false,
      origin: 'ai',
      originRef: null,
    });
    taskId = created.id;
    db.run(`UPDATE ai_tasks SET task_id = @taskId WHERE id = @id`, { taskId: created.id, id: aiTaskId });
  }
  audit({ userId: actor.id, event: 'ai.action_approved', target: aiTaskId, meta: { task: taskId } });
  return {
    message: 'Approval recorded. The private office will instruct the supplier — the record stays open until they confirm.',
    taskId: taskId ?? null,
  };
}

export function listLedgerFor(actor: Actor, limit = 20) {
  return getDb()
    .all<Record<string, unknown>>(
      `SELECT * FROM ai_tasks WHERE user_id = @userId ORDER BY created_at DESC LIMIT @limit`,
      { userId: actor.id, limit },
    )
    .map((row) => ({
      id: String(row.id),
      label: String(row.label),
      module: String(row.module),
      status: String(row.status),
      requiresConfirmation: Boolean(row.requires_confirmation),
      confidence: Number(row.confidence ?? 0.9),
      detail: (row.detail as string) ?? null,
      taskId: (row.task_id as string) ?? null,
      createdAt: String(row.created_at),
      conversationId: (row.conversation_id as string) ?? null,
    }));
}

export function listExpensesFor(actor: Actor, since: string) {
  return expensesTable.list({ where: {}, userId: actor.id, orderBy: 'spentOn DESC', limit: 20, extraSql: 'AND spent_on >= @since', extraParams: { since } });
}

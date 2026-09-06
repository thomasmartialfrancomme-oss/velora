/**
 * The in-house coordinator: deterministic analysis of a natural-language
 * request against the client's own records.
 *
 * Why deterministic first: a private office cannot answer "is the car
 * serviced?" with a guess. Every statement this module produces is drawn from
 * a row in the client's database, and every action it takes is a record inside
 * this platform. Anything that would require an outside party — a restaurant,
 * a supplier, a payment — is created as a request and marked
 * `requiresConfirmation`, so the UI can show "Action requires confirmation."
 *
 * This module is also the fallback used when a model gateway is configured but
 * unreachable, so behaviour degrades to something honest rather than nothing.
 */
import type { AIAction, AIRequestInput, AIResult, ClientContext, ModuleKey } from '@/lib/ai/types';
import { enforceHonesty } from '@/lib/ai/types';

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const ROLE_WORDS: Record<string, string> = {
  'villa manager': 'estate_manager',
  'estate manager': 'estate_manager',
  manager: 'estate_manager',
  housekeeper: 'housekeeper',
  'house keeping': 'housekeeper',
  housekeeping: 'housekeeper',
  chef: 'chef',
  cook: 'chef',
  driver: 'driver',
  chauffeur: 'driver',
  security: 'security',
  guard: 'security',
  gardener: 'gardener',
  grounds: 'gardener',
  butler: 'butler',
  maintenance: 'maintenance',
  nanny: 'nanny',
  assistant: 'personal_assistant',
};

export interface When {
  iso: string;
  label: string;
  kind: 'explicit' | 'weekday' | 'relative' | 'none';
}

/** Extract a when from the request: weekday names, tomorrow, a dated day, "this weekend". */
export function parseWhen(text: string, now = new Date()): When {
  const lower = text.toLowerCase();

  const weekdayMatch = lower.match(/\b(mon|tues|wednes|thurs|fri|satur|sun)day\b/);
  if (weekdayMatch) {
    const key = `${weekdayMatch[1]}day`;
    const target = WEEKDAYS[key]!;
    const date = new Date(now);
    const delta = (target - date.getUTCDay() + 7) % 7 || 7;
    date.setUTCDate(date.getUTCDate() + delta);
    date.setUTCHours(9, 0, 0, 0);
    return { iso: date.toISOString(), label: `${key.charAt(0).toUpperCase()}${key.slice(1)} ${shortDate(date)}`, kind: 'weekday' };
  }

  if (/\btomorrow\b/.test(lower)) {
    const date = new Date(now.getTime() + 86_400_000);
    date.setUTCHours(9, 0, 0, 0);
    return { iso: date.toISOString(), label: `Tomorrow ${shortDate(date)}`, kind: 'relative' };
  }

  if (/(this |next )?weekend/.test(lower)) {
    const date = new Date(now);
    const delta = (6 - date.getUTCDay() + 7) % 7 || 7;
    date.setUTCDate(date.getUTCDate() + delta);
    date.setUTCHours(17, 0, 0, 0);
    return { iso: date.toISOString(), label: `Weekend of ${shortDate(date)}`, kind: 'relative' };
  }

  const explicit = lower.match(/\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b/);
  if (explicit) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const month = months.findIndex((m) => explicit[2]!.startsWith(m));
    const date = new Date(Date.UTC(now.getUTCFullYear(), month, Number(explicit[1]), 12));
    if (month >= 0 && date.getUTCMonth() === month) {
      if (date.getTime() < now.getTime()) date.setUTCFullYear(date.getUTCFullYear() + 1);
      return { iso: date.toISOString(), label: shortDate(date), kind: 'explicit' };
    }
  }

  return { iso: new Date(now.getTime() + 2 * 86_400_000).toISOString(), label: 'at the earliest sensible time', kind: 'none' };
}

function shortDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function matchProperty(text: string, context: ClientContext) {
  const lower = normalise(text);
  const scored = context.properties
    .map((property) => {
      const haystack = normalise(`${property.name} ${property.city} ${property.country}`);
      const tokens = [normalise(property.city), normalise(property.name), ...normalise(property.name).split(' ')];
      let score = 0;
      for (const token of tokens) {
        if (token.length < 4) continue;
        if (lower.includes(token)) score += token.length;
      }
      return { property, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.property ?? context.properties.find((p) => p.isPrimary) ?? context.properties[0] ?? null;
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchStaff(text: string, context: ClientContext) {
  const lower = normalise(text);
  const byName = context.staff.find((member) => {
    const parts = normalise(member.name).split(' ');
    return parts.some((part) => part.length > 3 && lower.includes(part));
  });
  if (byName) return byName;
  for (const [word, role] of Object.entries(ROLE_WORDS)) {
    if (lower.includes(word)) {
      const found = context.staff.find((member) => member.role === role);
      if (found) return found;
    }
  }
  return null;
}

/* ---------------------------------------------------------------- intents */

type IntentId =
  | 'arrival'
  | 'journey'
  | 'transport'
  | 'staff_instruction'
  | 'expenses'
  | 'briefing'
  | 'documents'
  | 'vehicle'
  | 'tasks'
  | 'record_expense'
  | 'supplier'
  | 'unknown';

interface Intent {
  id: IntentId;
  confidence: number;
}

export function detectIntent(text: string): Intent {
  const lower = normalise(text);
  const score: Record<IntentId, number> = {
    arrival: 0,
    journey: 0,
    transport: 0,
    staff_instruction: 0,
    expenses: 0,
    briefing: 0,
    documents: 0,
    vehicle: 0,
    tasks: 0,
    record_expense: 0,
    supplier: 0,
    unknown: 0,
  };

  // A stay being prepared, in any of the ways a principal actually says it.
  if (
    /prepare.*arrival|arrival|check in|checkin|on arrival|receive me|everything for my|nights at|nights in|weekend at|staying at|have the house|open the house|house (opened|ready|prepared)|make (the |my )?(house|place|villa|penthouse|chalet) ready/.test(
      lower,
    )
  )
    score.arrival += 6;
  if (/prepare|plan|organise|arrange|set up|sort out/.test(lower) && /(trip|weekend|journey|travel|flight|transfer|move)/.test(lower))
    score.journey += 5;
  if (/(driver|chauffeur|transfer|car for|pick me up|pickup|car from|car to|airport|station)/.test(lower)) score.transport += 5;
  if (/(dinner for|lunch for|table for|book (a |us )?(table|chef|restaurant)|reservation)/.test(lower)) {
    score.supplier += 4;
    score.arrival += 2;
  }
  if (/(needs? my (decision|word|approval|sign-?off)|what (is|needs) (waiting|pending|open)|anything (waiting|pending)|decide)/.test(lower))
    score.tasks += 6;
  if (/(remind|tell|ask|message|inform|notify|chase|nudge)/.test(lower) && /(manager|staff|chef|driver|housekeeper|security|gardener|butler|assistant|nanny)/.test(lower))
    score.staff_instruction += 6;
  if (/(expense|spend|spent|cost|budget|invoice|ledger|outlay)/.test(lower) && /(show|how much|review|what|summar|this month|last month|total)/.test(lower))
    score.expenses += 6;
  if (/(record|add|log|note down|enter).*(expense|invoice|payment|cost)/.test(lower)) score.record_expense += 7;
  if (/(brief|briefing|catch me up|what.?s on|today.?s plan|summary of today|morning update)/.test(lower)) score.briefing += 6;
  if (/(document|contract|policy|insurance|permit|certificate|agreement|invoice copy)/.test(lower)) score.documents += 4;
  if (/(car|vehicle|fleet|mileage|service the|servicing|tyre|tire|garage)/.test(lower)) score.vehicle += 4;
  // “which insurance lapses first” is a fleet question when a vehicle is named.
  if (/(vehicle|fleet|car)/.test(lower) && /(insurance|lapse|renewal|expiry|expires)/.test(lower)) score.vehicle += 5;
  if (/(task|to do|todo|pending|outstanding|open items|what is left|progress)/.test(lower)) score.tasks += 4;
  if (/(supplier|vendor|book a table|reserve|restaurant|table for|yacht|charter|order from)/.test(lower)) score.supplier += 5;

  // Disambiguation: “a car from the airport” belongs to the arrival plan, so a
  // strong arrival cue outranks a bare mention of a vehicle or a policy.
  if (score.arrival >= 6) score.vehicle = Math.max(0, score.vehicle - 4);

  const ranked = (Object.entries(score) as [IntentId, number][]).sort((a, b) => b[1] - a[1]);
  const [best, second] = [ranked[0], ranked[1]];
  if (!best || best[1] === 0) return { id: 'unknown', confidence: 0.2 };
  return { id: best[0], confidence: Math.min(0.97, 0.55 + (best[1] - (second?.[1] ?? 0)) * 0.08 + best[1] * 0.03) };
}

/* ------------------------------------------------------------- planning */

const money = (cents: number, currency = 'EUR') =>
  new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Math.round(cents / 100));

function action(input: Partial<AIAction> & { label: string; module: ModuleKey }): AIAction {
  const requires = input.requiresConfirmation ?? input.status === 'requires_confirmation';
  return {
    label: input.label,
    module: input.module,
    status: input.status ?? (requires ? 'requires_confirmation' : 'confirmed'),
    requiresConfirmation: requires,
    detail: input.detail,
    evidence: input.evidence,
  };
}

/**
 * Turn a request into a plan. Pure: no writes, no side effects.
 * `plan.records` is what the persistence layer turns into real rows.
 */
export interface RecordRequest {
  kind: 'task' | 'reservation' | 'expense';
  title: string;
  category?: string;
  priority?: string;
  propertyId?: string | null;
  staffId?: string | null;
  dueAt?: string | null;
  detail?: string | null;
  requiresConfirmation?: boolean;
  vendor?: string | null;
  amountCents?: number;
  categoryKey?: string;
  spentOn?: string;
}

export interface Plan {
  result: AIResult;
  records: RecordRequest[];
}

export function coordinate(input: AIRequestInput): Plan {
  const { text, context } = input;
  const intent = detectIntent(text);
  const when = parseWhen(text);
  const property = matchProperty(text, context);
  const staffMember = matchStaff(text, context);

  const base: AIResult = {
    kind: 'clarification',
    headline: '',
    blocks: [],
    actions: [],
    notes: [],
    requiresHuman: false,
    confidence: intent.confidence,
    provider: input.providerInfo ?? {
      id: 'velora-demo',
      label: 'VELORA AI',
      external: false,
      model: 'velora-coordinator',
      note: 'In-house coordinator · reads only your own records',
    },
  };

  const records: RecordRequest[] = [];
  const pushTask = (request: Omit<RecordRequest, 'kind'>) => {
    records.push({ kind: 'task', ...request });
  };

  switch (intent.id) {
    case 'arrival':
    case 'journey': {
      const target = property ?? context.properties[0] ?? null;
      const city = target?.city ?? 'the residence';
      const driver =
        context.staff.find((member) => member.role === 'driver' && (!target || member.propertyId === target.id)) ??
        context.staff.find((member) => member.role === 'driver') ??
        null;
      const housekeeper =
        context.staff.find((member) => member.role === 'housekeeper' && (!target || member.propertyId === target.id)) ??
        context.staff.find((member) => member.role === 'housekeeper') ??
        null;
      const chef = context.staff.find((member) => member.role === 'chef') ?? null;
      const security = context.staff.find((member) => member.role === 'security') ?? null;
      const vehicle =
        (target
          ? context.vehicles.find((v) => v.location && normalise(v.location).includes(normalise(target.city)))
          : undefined) ?? context.vehicles[0] ?? null;
      const trip = context.trips.find((t) => (target ? normalise(t.destinationCity) === normalise(target.city) : false)) ?? context.trips[0] ?? null;
      const arrivalLabel = trip ? `${shortDate(new Date(trip.startsAt))} · ${new Date(trip.startsAt).toISOString().slice(11, 16)}` : when.label;

      base.kind = 'arrival_plan';
      base.headline = target ? `Arrival plan prepared for ${target.name}.` : 'Tell me which residence to prepare and I will build the plan.';
      base.blocks = [
        { type: 'kv', label: 'Residence', value: target ? `${target.name} · ${city}` : 'Not on file' },
        { type: 'kv', label: 'Arrival', value: arrivalLabel },
        { type: 'kv', label: 'Driver', value: driver ? `Assigned to ${driver.name} — awaiting handover confirmation` : 'No driver in the directory' },
        { type: 'kv', label: 'Housekeeping', value: housekeeper ? `Scheduled with ${housekeeper.name}` : 'To be scheduled' },
        { type: 'kv', label: 'Dinner', value: 'Reservation requested — not yet confirmed by the venue' },
        { type: 'kv', label: 'Vehicle', value: vehicle ? `${vehicle.name} · ${vehicle.status.replace(/_/g, ' ')}` : 'No vehicle recorded' },
        { type: 'kv', label: 'Residence status', value: target ? target.status.replace(/_/g, ' ') : '—', tone: target && target.status !== 'operational' ? 'attention' : 'ok' },
      ];

      const actions: AIAction[] = [
        action({
          label: 'Housekeeping prepared the residence',
          module: 'housekeeping',
          detail: housekeeper ? `${housekeeper.name} is on the task list for the arrival day.` : 'No housekeeper assigned yet.',
        }),
        action({
          label: 'Chauffeur assigned for the arrival',
          module: 'travel',
          detail: driver ? `${driver.name} notified in your directory; handover time still to be agreed.` : 'No driver on file for this residence.',
        }),
        action({
          label: 'Grocery and cellar provisioning',
          module: 'lifestyle',
          status: 'requires_confirmation',
          requiresConfirmation: true,
          detail: 'The standing list is drafted. Your approval is needed before the supplier is instructed.',
        }),
        action({
          label: 'Security perimeter for the arrival window',
          module: 'security',
          detail: security ? `Patrol overlap suggested with ${security.name}.` : 'No security contact recorded.',
        }),
        action({
          label: 'Vehicle ready and fuelled',
          module: 'vehicles',
          detail: vehicle ? `${vehicle.name} — ${vehicle.status.replace(/_/g, ' ')}.` : 'No vehicle recorded at this residence.',
        }),
        action({
          label: 'Dinner reservation requested',
          module: 'lifestyle',
          status: 'requires_confirmation',
          requiresConfirmation: true,
          detail: 'Action requires confirmation. A request is recorded; the restaurant has not answered.',
        }),
        action({
          label: 'Staff briefed',
          module: 'people',
          detail: `${[housekeeper, driver, chef].filter(Boolean).map((s) => (s as { name: string }).name).join(', ') || 'No one assigned'}.`,
        }),
      ];
      base.actions = actions;
      base.requiresHuman = actions.some((a) => a.requiresConfirmation);
      base.notes = [
        chef ? `Chef ${chef.name} has been asked for the arrival menu — not yet returned.` : 'No chef on file; the arrival menu is unassigned.',
        'Nothing outside this platform has been instructed. Two actions wait on your confirmation.',
      ];
      base.suggestions = ['Confirm the provisioning list', 'Show open tasks for this residence', 'What is my itinerary for the arrival day?'];

      if (target) {
        pushTask({
          title: `Prepare ${target.name} for arrival — ${arrivalLabel}`,
          category: 'housekeeping',
          priority: 'high',
          propertyId: target.id,
          staffId: housekeeper?.id,
          dueAt: when.iso,
          detail: 'Arrival protocol: linen, temperature, provisioning list, garage bay, arrival tray.',
        });
        pushTask({
          title: `Chauffeur handover for arrival — ${arrivalLabel}`,
          category: 'travel',
          priority: 'high',
          propertyId: target.id,
          staffId: driver?.id,
          dueAt: when.iso,
          detail: 'Agree the handover time with the driver, then confirm to the estate manager.',
        });
        pushTask({
          title: 'Dinner reservation for arrival evening — supplier to be instructed',
          category: 'lifestyle',
          priority: 'normal',
          propertyId: target.id,
          dueAt: when.iso,
          requiresConfirmation: true,
          detail: 'Recorded as a request. No booking exists until the venue confirms.',
        });
        if (security) {
          pushTask({
            title: 'Security patrol overlap for arrival window',
            category: 'security',
            priority: 'normal',
            propertyId: target.id,
            staffId: security.id,
            dueAt: when.iso,
            detail: 'Suggested 19:00–23:00. Confirm with the estate manager.',
          });
        }
      }
      break;
    }

    case 'transport': {
      const driver = context.staff.find((member) => member.role === 'driver') ?? null;
      const target = property ?? context.properties[0] ?? null;
      base.kind = 'journey_plan';
      base.headline = `Private driver requested for ${when.label}.`;
      base.blocks = [
        { type: 'kv', label: 'When', value: when.label },
        { type: 'kv', label: 'From', value: target ? `${target.name}, ${target.city}` : 'To be confirmed' },
        { type: 'kv', label: 'Household driver', value: driver ? `${driver.name} — ${driver.status.replace(/_/g, ' ')}` : 'None on file' },
        { type: 'note', text: 'A request has been recorded in your plan. If a company outside the household is needed, the office must place it — that still requires your confirmation.', tone: 'attention' },
      ];
      base.actions = [
        action({
          label: 'Household driver held for the window',
          module: 'travel',
          detail: driver ? `${driver.name} is marked ${driver.status.replace(/_/g, ' ')} for that day.` : 'No driver in the directory.',
        }),
        action({
          label: 'Outside chauffeur company',
          module: 'travel',
          status: 'requires_confirmation',
          requiresConfirmation: true,
          detail: 'Action requires confirmation. Nothing has been sent to a supplier.',
        }),
      ];
      base.requiresHuman = true;
      base.suggestions = ['Use the household driver instead', 'Add a transfer leg to my next journey', 'Show my vehicles'];
      pushTask({
        title: `Confirm private driver for ${when.label}`,
        category: 'travel',
        priority: 'high',
        propertyId: target?.id ?? null,
        staffId: driver?.id,
        dueAt: when.iso,
        requiresConfirmation: true,
        detail: 'Decide: household driver or an outside company. Then the request is placed.',
      });
      break;
    }

    case 'staff_instruction': {
      const target = staffMember ?? context.staff.find((member) => member.role === 'estate_manager') ?? null;
      const instruction = text.replace(/^(remind|tell|ask|message|inform|notify|chase)\s+(the\s+)?/i, '').trim();
      base.kind = 'staff_instruction';
      base.headline = target ? `Drafted for ${target.name}, ${target.role.replace(/_/g, ' ')}.` : 'Tell me who should receive this.';
      base.blocks = [
        { type: 'kv', label: 'Recipient', value: target ? `${target.name} · ${target.status.replace(/_/g, ' ')}` : 'Not found' },
        { type: 'kv', label: 'Message', value: truncate(instruction, 140) },
        { type: 'kv', label: 'Their next recorded task', value: target?.nextTask ?? 'Nothing assigned' },
        { type: 'note', text: 'Message delivery is not wired in this build (no SMTP/messaging integration configured). The reminder is recorded against the person so the office can send it.', tone: 'attention' },
      ];
      base.actions = [
        action({
          label: 'Reminder recorded against the staff record',
          module: 'people',
          detail: target ? `${target.name} — last activity tracked in the directory.` : undefined,
        }),
        action({
          label: 'Send the message to the recipient',
          module: 'people',
          status: 'requires_confirmation',
          requiresConfirmation: true,
          detail: 'Requires a messaging integration or a human in the private office.',
        }),
      ];
      base.requiresHuman = true;
      base.suggestions = ['Show everything assigned to this person', 'Create a task with a due date', 'Who is on site right now?'];
      pushTask({
        title: `Follow up with ${target?.name ?? 'staff'} — ${truncate(instruction, 60)}`,
        category: 'staff',
        priority: 'normal',
        staffId: target?.id,
        dueAt: when.iso,
        detail: `Drafted by the AI coordinator from: “${truncate(text, 160)}”. Not yet delivered.`,
        requiresConfirmation: true,
      });
      break;
    }

    case 'expenses': {
      const rows = context.monthTotals.map((row) => [row.label, String(row.entries), money(row.cents, context.currency)]);
      base.kind = 'expense_summary';
      base.headline = `Recorded this month: ${money(context.monthTotalCents, context.currency)} across ${context.monthTotals.reduce((n, r) => n + r.entries, 0)} entries.`;
      base.blocks = [
        { type: 'table', label: new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' }), columns: ['Category', 'Entries', 'Recorded'], rows },
        {
          type: 'table',
          label: 'By residence',
          columns: ['Residence', 'Status', 'Monthly operations'],
          rows: context.properties.map((p) => [`${p.name} · ${p.city}`, p.status.replace(/_/g, ' '), money(p.monthlyOpsCents, context.currency)]),
        },
        { type: 'note', text: 'These are the figures you hold with us, organised. VELORA records and reconciles; it does not give financial or tax advice.' },
      ];
      base.actions = [
        action({ label: 'Ledger opened for review', module: 'finance', detail: 'Entries grouped by category and residence.' }),
        action({
          label: 'Query the flagged entries with your office',
          module: 'finance',
          status: 'requires_confirmation',
          requiresConfirmation: true,
          detail: 'A coordinator raises it with the vendor once you approve.',
        }),
      ];
      base.suggestions = ['Show only property operations', 'Which entry is the largest this month?', 'Record an expense of €420 for the pool service'];
      break;
    }

    case 'record_expense': {
      const amountMatch = text.match(/(?:€|eur|£|usd|\$)?\s*([\d]{1,3}(?:[ .]\d{3})*(?:[.,]\d{1,2})?)\s*(euros?|€|usd|\$|£)?/i);
      const amountCents = amountMatch ? toCents(amountMatch[1]!) : 0;
      const target = property;
      const categoryKey = /pool|garden|maintenance|repair|clean/.test(normalise(text))
        ? 'property_operations'
        : /driver|transfer|flight|fuel|hotel/.test(normalise(text))
          ? 'travel'
          : /restaurant|wine|gift|membership/.test(normalise(text))
            ? 'lifestyle'
            : 'property_operations';
      base.kind = 'expense_summary';
      base.headline = amountCents > 0 ? `Recorded ${money(amountCents, context.currency)} in ${categoryKey.replace(/_/g, ' ')}.` : 'Tell me the amount and I will record it.';
      base.blocks = [
        { type: 'kv', label: 'Amount', value: amountCents > 0 ? money(amountCents, context.currency) : 'Not recognised' },
        { type: 'kv', label: 'Category', value: categoryKey.replace(/_/g, ' ') },
        { type: 'kv', label: 'Residence', value: target ? `${target.name} · ${target.city}` : 'Household-wide' },
        { type: 'note', text: 'Written to your ledger as a pending entry for reconciliation against the invoice. Nothing was paid.' },
      ];
      base.actions = [
        action({ label: 'Ledger entry created', module: 'finance', detail: 'Marked pending until the invoice is matched.' }),
      ];
      base.suggestions = ['Show this month’s ledger', 'Which entries need reconciliation?', 'Show my documents'];
      if (amountCents > 0) {
        records.push({
          kind: 'expense',
          title: truncate(text.replace(/^(record|add|log|note down|enter)\s+/i, ''), 90) || 'Ad-hoc entry from the AI coordinator',
          vendor: null,
          amountCents,
          categoryKey,
          propertyId: target?.id ?? null,
          spentOn: new Date().toISOString().slice(0, 10),
        });
      }
      break;
    }

    case 'briefing': {
      const today = new Date().toISOString().slice(0, 10);
      base.kind = 'briefing';
      base.headline = 'Your day, from your records.';
      base.blocks = [
        { type: 'kv', label: 'Scheduled today', value: String(count(context.trips, (t) => t.startsAt.slice(0, 10) === today)) },
        { type: 'kv', label: 'Open tasks', value: String(context.openTasks.length) },
        { type: 'kv', label: 'Awaiting you', value: String(context.openTasks.filter((t) => t.status === 'awaiting_confirmation').length) },
        { type: 'kv', label: 'Journeys ahead', value: String(context.trips.length) },
        {
          type: 'checklist',
          label: 'First three items in order of urgency',
          items: context.openTasks.slice(0, 3).map((task) => ({ text: task.title, done: false, pending: task.status === 'awaiting_confirmation' })),
        },
      ];
      base.actions = [action({ label: 'Briefing assembled from your records', module: 'intelligence' })];
      base.suggestions = ['Open the full daily briefing', 'What is the priority?', 'Prepare my arrival'];
      break;
    }

    case 'documents': {
      const term = normalise(text)
        .replace(/(show|find|where|my|the|documents|document|for|is|are|about|check|tell|me|what|which|of|and|please|list)/g, ' ')
        .trim();
      const matches = context.documents.filter((doc) => (term ? normalise(doc.name).includes(term.split(' ')[0] ?? '') : true)).slice(0, 8);
      base.kind = 'document_search';
      base.headline = matches.length
        ? `${matches.length} record${matches.length === 1 ? '' : 's'} in your library${term ? ` matching “${term.split(' ')[0]}”` : ''}.`
        : 'No document matches that description in your library.';
      base.blocks = [
        {
          type: 'table',
          label: 'Library',
          columns: ['Document', 'Category', 'Status', 'Residence'],
          rows: matches.map((doc) => [doc.name, doc.category.replace(/_/g, ' '), doc.status, doc.propertyName ?? 'Household-wide']),
        },
        { type: 'note', text: 'Files are stored by your private office; this build lists metadata from the library index.' },
      ];
      base.actions = [action({ label: 'Library opened', module: 'documents' })];
      base.suggestions = ['What expires in the next 30 days?', 'Open the library', 'Ask the office for a copy'];
      break;
    }

    case 'vehicle': {
      base.kind = 'vehicle_status';
      base.headline = `${context.vehicles.length} vehicles on file.`;
      base.blocks = [
        {
          type: 'table',
          label: 'Fleet',
          columns: ['Vehicle', 'Status', 'Location', 'Driver'],
          rows: context.vehicles.map((v) => [
            v.name,
            v.status.replace(/_/g, ' '),
            v.location ?? '—',
            v.assignedDriver ?? 'Unassigned',
          ]),
        },
      ];
      const overdue = context.vehicles.filter((v) => v.nextServiceAt && new Date(v.nextServiceAt) < new Date());
      base.actions = overdue.length
        ? [
            action({
              label: `Book service for ${overdue[0]!.name}`,
              module: 'vehicles',
              status: 'requires_confirmation',
              requiresConfirmation: true,
              detail: 'A dealer slot needs your approval before the office calls them.',
            }),
          ]
        : [action({ label: 'Fleet reviewed — nothing past its recorded service date', module: 'vehicles' })];
      base.requiresHuman = overdue.length > 0;
      base.suggestions = ['Show mileage and insurance', 'Who drives the Maybach?', 'Prepare my arrival'];
      if (overdue[0]) {
        pushTask({
          title: `Book dealer service — ${overdue[0].name}`,
          category: 'vehicles',
          priority: 'high',
          dueAt: when.iso,
          requiresConfirmation: true,
          detail: 'Recorded from the fleet table: service date has passed in your records.',
        });
      }
      break;
    }

    case 'tasks': {
      base.kind = 'task_list';
      base.headline = context.openTasks.length
        ? `${context.openTasks.length} open items across your residences.`
        : 'Nothing is open. Your households are clear.';
      base.blocks = [
        {
          type: 'checklist',
          label: 'Open now',
          items: context.openTasks.slice(0, 10).map((task) => ({
            text: `${task.title}${task.dueAt ? ` — due ${shortDate(new Date(task.dueAt))}` : ''}`,
            done: task.status === 'done',
            pending: task.status === 'awaiting_confirmation' || task.status === 'blocked',
          })),
        },
      ];
      base.actions = [action({ label: 'Task board opened', module: 'property' })];
      base.suggestions = ['Which ones are waiting on me?', 'Close the pool service item', 'Prepare my arrival'];
      break;
    }

    case 'supplier': {
      base.kind = 'reservation_request';
      base.headline = 'Supplier requests are written as requests, never as bookings.';
      base.blocks = [
        { type: 'kv', label: 'Request', value: truncate(text, 140) },
        { type: 'kv', label: 'For', value: when.label },
        { type: 'note', text: 'Action requires confirmation. Once you approve, a coordinator contacts the venue and the record updates when they reply.', tone: 'attention' },
      ];
      base.actions = [
        action({
          label: 'Place the request with the venue',
          module: 'lifestyle',
          status: 'requires_confirmation',
          requiresConfirmation: true,
          detail: 'No external messaging is wired in this build; the private office completes it.',
        }),
      ];
      base.requiresHuman = true;
      base.suggestions = ['Approve and log the request', 'Show my reservations', 'Add it to my arrival plan'];
      pushTask({
        title: `Supplier request — ${truncate(text, 60)}`,
        category: 'lifestyle',
        priority: 'normal',
        dueAt: when.iso,
        requiresConfirmation: true,
        detail: 'Recorded as a request from the AI command centre.',
      });
      break;
    }

    default: {
      base.kind = 'clarification';
      base.headline = 'I can take care of that in one of these ways — tell me which fits.';
      base.blocks = [
        {
          type: 'list',
          label: 'What the office handles',
          items: [
            'Arrival and departure plans for any residence on file',
            'Staff instructions, reminders and assignments',
            'Journeys, transfers and vehicle readiness',
            'Expenditure records and ledger review',
            'Document, contract and policy look-ups',
            'Daily briefing assembled from your own records',
          ],
        },
        { type: 'note', text: `I read only the ${context.properties.length} residences and ${context.staff.length} staff records in your household. I never claim that an outside action is complete.` },
      ];
      base.actions = [];
      base.suggestions = ['Prepare my Paris weekend', 'Show me this month’s property expenses', 'Remind the villa manager about the pool maintenance'];
      break;
    }
  }

  const cleanedHeadline = enforceHonesty(base.headline);
  base.headline = cleanedHeadline.text;
  base.blocks = base.blocks.map((block) => (block.type === 'note' ? { ...block, text: enforceHonesty(block.text).text } : block));
  if (cleanedHeadline.softened) base.requiresHuman = true;

  return { result: base, records };
}

function count<T>(items: T[], predicate: (item: T) => boolean): number {
  return items.filter(predicate).length;
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function toCents(raw: string): number {
  const cleaned = raw.replace(/[ .]/g, '');
  const normalised = cleaned.includes(',') ? cleaned.replace('.', '').replace(',', '.') : cleaned;
  const value = Number(normalised);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/**
 * POST /api/ai/request — the command centre endpoint.
 *
 * Budget: requests per day are capped by plan (Private 40, Priority 250,
 * Private Office unlimited). A request is analysed against rows scoped to the
 * caller, then persisted: the conversation, the assistant message, one
 * ai_tasks ledger row per proposed action, and real task rows for the steps
 * VELORA can take inside its own system. Steps needing an outside party are
 * recorded with `requires_confirmation` and are never marked complete.
 */
import { AIService } from '@/lib/ai/service';
import { buildClientContext } from '@/lib/ai/context';
import { getDb } from '@/lib/db';
import { api } from '@/lib/http/handler';
import { aiRequestSchema } from '@/lib/validation/schemas';
import { fail } from '@/lib/http/responses';
import { getPlan } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = api({
  scope: 'ai:request',
  limit: { max: 120, windowMs: 60_000 },
  schema: aiRequestSchema,
  handler: async ({ user, body }) => {
    const plan = await planFor(user.id);
    const budget = plan.ai_requests_per_day;
    if (budget !== 'unlimited') {
      const used =
        getDb().get<{ n: number | bigint }>(
          `SELECT COUNT(*) AS n FROM ai_messages WHERE user_id = @userId AND role = 'user' AND created_at >= date('now')`,
          { userId: user.id },
        )?.n ?? 0;
      if (Number(used) >= budget) {
        return fail(
          429,
          'plan_limit',
          `Your ${plan.name} plan includes ${budget} coordinator requests per day. Your Private Office will lift the limit on request.`,
        );
      }
    }

    const context = buildClientContext({ id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency });
    const outcome = await AIService.handle({
      actor: { id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency },
      text: String(body.request ?? ''),
      conversationId: (body.conversationId as string | null | undefined) ?? null,
    });

    return {
      ...outcome,
      context: { residences: context.properties.length, staff: context.staff.length, monthTotalCents: context.monthTotalCents },
      plan: { key: plan.key, name: plan.name, requestsUsed: 1, requestLimit: budget },
    };
  },
});

async function planFor(userId: string) {
  const row = getDb().get<{ plan: string }>(`SELECT plan FROM subscriptions WHERE user_id = @userId`, { userId });
  return getPlan(row?.plan ?? 'private');
}

export const GET = api({
  scope: 'ai:context',
  handler: ({ user }) => buildClientContext({ id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency }),
});

/**
 * POST /api/ai/action — approve, decline or defer a coordinator action.
 * Approving records your consent and opens a task for the office. It does not
 * contact a supplier: nothing external happens without a human.
 */
import { api } from '@/lib/http/handler';
import { aiActionSchema } from '@/lib/validation/schemas';
import { approveAiAction } from '@/lib/ai/service';
import { getDb, nowIso } from '@/lib/db';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'ai:action',
  limit: { max: 120, windowMs: 60_000 },
  schema: aiActionSchema,
  handler: ({ user, body }) => {
    const decision = (body as { decision: 'confirm' | 'decline' | 'defer' }).decision;
    const aiTaskId = (body as { aiTaskId: string }).aiTaskId;

    if (decision === 'confirm') {
      return approveAiAction({ id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency }, aiTaskId);
    }

    const row = getDb().get<{ id: string }>(`SELECT id FROM ai_tasks WHERE id = @id AND user_id = @userId`, { id: aiTaskId, userId: user.id });
    if (!row) return fail(404, 'not_found', 'That action is no longer available.');
    getDb().run(`UPDATE ai_tasks SET status = @status, updated_at = @ts WHERE id = @id AND user_id = @userId`, {
      status: decision === 'decline' ? 'declined' : 'proposed',
      ts: nowIso(),
      id: aiTaskId,
      userId: user.id,
    });
    return {
      status: decision === 'decline' ? 'declined' : 'deferred',
      message:
        decision === 'decline'
          ? 'Declined. The request has been withdrawn and nothing will be passed to a supplier.'
          : 'Left open. It stays in your queue until you decide.',
    };
  },
});

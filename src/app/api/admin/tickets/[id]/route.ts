/** PATCH /api/admin/tickets/[id] — answer or close a support request. */
import { api } from '@/lib/http/handler';
import { adminTicketSchema } from '@/lib/validation/schemas';
import { updateTicket } from '@/lib/data/admin';
import { audit, getDb, nowIso } from '@/lib/db';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'admin:ticket',
  auth: 'admin',
  schema: adminTicketSchema,
  handler: ({ user, params, body }) => {
    const row = getDb().get<{ id: string; user_id: string }>(`SELECT id, user_id FROM tickets WHERE id = @id`, { id: params.id });
    if (!row) return fail(404, 'not_found', 'That ticket does not exist.');
    const patch = body as { status: 'open' | 'in_review' | 'answered' | 'closed'; reply?: string | null; assignee?: string | null };
    updateTicket(params.id, patch);
    if (patch.reply) {
      getDb().run(
        `INSERT INTO notifications (id, user_id, kind, title, body, severity, action_label, action_href, created_at)
         VALUES (@id, @userId, 'system', 'The office answered your request', @body, 'info', 'Read the reply', '/support', @ts)`,
        { id: `ntf_${Date.now()}`, userId: row.user_id, body: patch.reply.slice(0, 400), ts: nowIso() },
      );
    }
    audit({ userId: user.id, event: 'admin.ticket_updated', target: params.id, meta: { status: patch.status, replied: Boolean(patch.reply) } });
    return { updated: true };
  },
});

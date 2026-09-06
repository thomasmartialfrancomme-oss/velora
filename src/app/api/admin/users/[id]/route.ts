/**
 * PATCH /api/admin/users/[id] — role and account status.
 * An administrator cannot demote or suspend themselves: it is the fastest way
 * to lock a deployment out of its own console.
 */
import { api } from '@/lib/http/handler';
import { adminUserUpdateSchema } from '@/lib/validation/schemas';
import { setUserRole, setUserStatus } from '@/lib/data/admin';
import { audit, getDb } from '@/lib/db';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'admin:user:update',
  auth: 'admin',
  schema: adminUserUpdateSchema,
  handler: ({ user, params, body }) => {
    if (params.id === user.id) return fail(400, 'self_modification', 'You cannot change your own role or status from this console.');
    const target = getDb().get<{ id: string }>(`SELECT id FROM users WHERE id = @id`, { id: params.id });
    if (!target) return fail(404, 'not_found', 'That account does not exist.');
    const patch = body as { role?: 'owner' | 'admin'; status?: 'active' | 'suspended' | 'invited' };
    if (patch.role) {
      setUserRole(params.id, patch.role);
      audit({ userId: user.id, event: 'admin.user_role_changed', target: params.id, meta: { role: patch.role } });
    }
    if (patch.status) {
      setUserStatus(params.id, patch.status);
      if (patch.status === 'suspended') {
        getDb().run(`UPDATE users SET sessions_revoked_at = @ts WHERE id = @id`, { ts: new Date().toISOString(), id: params.id });
      }
      audit({ userId: user.id, event: 'admin.user_status_changed', target: params.id, meta: { status: patch.status } });
    }
    return {
      updated: true,
      user: getDb().get(`SELECT id, email, role, status, sessions_revoked_at AS revokedAt FROM users WHERE id = @id`, { id: params.id }),
    };
  },
});

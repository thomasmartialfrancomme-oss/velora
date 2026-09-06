/** Password change: verifies the current passphrase, then revokes every session. */
import { api } from '@/lib/http/handler';
import { changePasswordSchema } from '@/lib/validation/schemas';
import { getDb, audit } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { revokeAllSessions, setPassword } from '@/lib/auth/session';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'account:password',
  limit: { max: 6, windowMs: 10 * 60_000 },
  schema: changePasswordSchema,
  handler: async ({ user, body }) => {
    const { current, next } = body as { current: string; next: string };
    const row = getDb().get<{ hash: string }>(`SELECT password_hash AS hash FROM users WHERE id = @id`, { id: user.id });
    if (!row || !(await verifyPassword(current, row.hash))) {
      audit({ userId: user.id, event: 'account.password_failed' });
      return fail(403, 'current_password_incorrect', 'Your current passphrase did not match.');
    }
    await setPassword(user.id, next);
    await revokeAllSessions(user.id, 'password_change');
    return { updated: true, message: 'Passphrase updated. Every other device has been signed out.' };
  },
});

/** POST /api/auth/reset — consumes a single-use token and revokes older sessions. */
import { NextResponse } from 'next/server';
import { resetPasswordSchema } from '@/lib/validation/schemas';
import { getDb, audit, nowIso } from '@/lib/db';
import { sha256 } from '@/lib/auth/password';
import { setPassword } from '@/lib/auth/session';
import { fail, toErrorResponse } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail(422, 'validation_failed', 'That reset link and passphrase combination is not usable.');
    const { token, password } = parsed.data;

    const db = getDb();
    const record = db.get<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
      `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = @hash`,
      { hash: sha256(token) },
    );
    const invalid = 'That reset link is not valid. Request a new one.';
    if (!record) return fail(400, 'invalid_token', invalid);
    if (record.used_at) return fail(410, 'token_used', 'That link has already been used. Request a new one.');
    if (Date.parse(record.expires_at) < Date.now()) return fail(410, 'token_expired', 'That link has expired. Request a new one.');

    await setPassword(record.user_id, password);
    db.run('UPDATE password_resets SET used_at = @ts WHERE id = @id', { ts: nowIso(), id: record.id });
    db.run('UPDATE users SET updated_at = @ts WHERE id = @id', { ts: nowIso(), id: record.user_id });
    audit({ userId: record.user_id, event: 'auth.reset_completed' });

    return NextResponse.json({ ok: true, data: { redirect: '/login', message: 'Passphrase updated. You may sign in.' } });
  } catch (error) {
    return toErrorResponse(error);
  }
}

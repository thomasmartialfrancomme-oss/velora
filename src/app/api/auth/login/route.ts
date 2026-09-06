/**
 * POST /api/auth/login
 *
 * Constant-shape responses: an unknown address and a wrong password return the
 * same message, so the endpoint cannot be used to enumerate accounts. Rate
 * limiting is keyed on IP + email, and the session cookie is set httpOnly.
 */
import { NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation/schemas';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';
import { getDb, audit, nowIso } from '@/lib/db';
import { clientIp, hashIp, rateLimitAuth } from '@/lib/http/security';
import { fail, toErrorResponse } from '@/lib/http/responses';
import { DEMO_CREDENTIALS } from '@db/demo-data.mjs';

export const dynamic = 'force-dynamic';

const GENERIC = 'We do not recognise that address and passphrase together.';

export async function POST(request: Request) {
  try {
    rateLimitAuth(request, 'any', 12, 60_000);
    const raw = await request.json().catch(() => null);
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) return fail(422, 'validation_failed', 'Enter your email address and passphrase.');

    const { email, password } = parsed.data;
    rateLimitAuth(request, email, 8, 5 * 60_000);

    const db = getDb();
    const row = db.get<{ id: string; email: string; password_hash: string; status: string; first_name: string; last_name: string; role: string }>(
      `SELECT id, email, password_hash, status, first_name, last_name, role FROM users WHERE lower(email) = lower(@email)`,
      { email },
    );

    const matches = row ? await verifyPassword(password, row.password_hash) : false;
    if (!row || !matches) {
      audit({ userId: row?.id ?? null, event: 'auth.failed', target: hashIp(clientIp(request)), meta: { email_domain: email.split('@')[1] } });
      return fail(401, 'invalid_credentials', GENERIC);
    }
    if (row.status === 'suspended') {
      return fail(403, 'suspended', 'This account is suspended. Your estate coordinator has been notified.');
    }

    await createSession(row.id);
    db.run('UPDATE users SET last_login_at = @ts WHERE id = @id', { ts: nowIso(), id: row.id });
    audit({ userId: row.id, event: 'session.sign_in', ipHash: hashIp(clientIp(request)) });

    return NextResponse.json({
      ok: true,
      data: {
        user: {
          id: row.id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
        },
        redirect: row.role === 'admin' ? '/admin' : '/dashboard',
        ...(process.env.NODE_ENV !== 'production' && isDemoAccount(email, password)
          ? { note: 'Demo account signed in. Data is fictional and stored locally.' }
          : {}),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

function isDemoAccount(email: string, password: string): boolean {
  const known = Object.values(DEMO_CREDENTIALS) as { email: string; password: string }[];
  return known.some((entry) => entry.email === email && entry.password === password);
}

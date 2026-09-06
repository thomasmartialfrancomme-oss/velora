/**
 * POST /api/auth/forgot-password
 *
 * Always answers the same way. A token is stored hashed with an expiry; the
 * email itself is only delivered when SMTP_URL is configured. With no mail
 * transport, the reset link is written to the server log (and returned in the
 * demo build) so the flow can still be walked end to end — never in production.
 */
import { NextResponse } from 'next/server';
import { forgotPasswordSchema } from '@/lib/validation/schemas';
import { getDb, audit, newId, nowIso } from '@/lib/db';
import { randomToken, sha256 } from '@/lib/auth/password';
import { rateLimitAuth } from '@/lib/http/security';
import { fail, toErrorResponse } from '@/lib/http/responses';
import { env } from '@/lib/config';

export const dynamic = 'force-dynamic';

const GENERIC = 'If that address holds an account, a reset link is on its way.';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) return fail(422, 'validation_failed', 'Enter the email address on your account.');
    const { email } = parsed.data;
    rateLimitAuth(request, email, 5, 10 * 60_000);

    const db = getDb();
    const user = db.get<{ id: string }>(`SELECT id FROM users WHERE lower(email) = lower(@email)`, { email });
    if (!user) {
      return NextResponse.json({ ok: true, data: { message: GENERIC } });
    }

    const token = randomToken(32);
    db.run(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
       VALUES (@id, @userId, @hash, @expires, @ts)`,
      {
        id: newId('rst'),
        userId: user.id,
        hash: sha256(token),
        expires: new Date(Date.now() + 30 * 60_000).toISOString(),
        ts: nowIso(),
      },
    );
    audit({ userId: user.id, event: 'auth.reset_requested' });

    const link = `${env.appUrl}/forgot-password?token=${token}&email=${encodeURIComponent(email)}`;
    if (!env.capabilities.smtpConfigured) {
      console.info(`[velora] password reset link (SMTP not configured): ${link}`);
    }

    return NextResponse.json({
      ok: true,
      data: {
        message: GENERIC,
        // Only ever present outside production, so the demo can continue.
        ...(env.isProduction ? {} : { devLink: link, token }),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

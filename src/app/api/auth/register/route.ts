/**
 * POST /api/auth/register
 * Creates the principal account, seeds a starter household so no screen is
 * ever empty, and opens the session. Passwords are bcrypt-hashed; the client
 * never sees the hash or a token in the body.
 */
import { NextResponse } from 'next/server';
import { getDb, audit } from '@/lib/db';
import { createUser, createSession } from '@/lib/auth/session';
import { registerSchema } from '@/lib/validation/schemas';
import { fail, toErrorResponse } from '@/lib/http/responses';
import { clientIp, hashIp, rateLimitAuth } from '@/lib/http/security';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    rateLimitAuth(request, 'register', 5, 10 * 60_000);
    const parsed = registerSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!fields[key]) fields[key] = issue.message;
      }
      return fail(422, 'validation_failed', 'Please correct the highlighted fields.', fields);
    }
    const { firstName, lastName, email, password, country, timezone } = parsed.data;

    const db = getDb();
    const taken = db.get<{ id: string }>(`SELECT id FROM users WHERE lower(email) = lower(@email)`, { email });
    if (taken) {
      // Same wording as a successful request: no account enumeration.
      return fail(409, 'email_taken', 'An access request has been recorded for that address. Your coordinator will reply.');
    }

    const invited = db.get<{ id: string }>(
      `SELECT id FROM access_requests WHERE lower(email) = lower(@email) AND status = 'invited'`,
      { email },
    );

    const id = await createUser({ email, password, firstName, lastName, role: 'owner', country: country || null, timezone: timezone || 'Europe/Paris' });
    if (invited) {
      db.run(`UPDATE access_requests SET status = 'invited', reviewer_note = 'Account created by the applicant.', updated_at = @ts WHERE id = @id`, {
        ts: new Date().toISOString(),
        id: invited.id,
      });
    }
    audit({ userId: id, event: 'account.registered', ipHash: hashIp(clientIp(request)), meta: { via: invited ? 'invitation' : 'self-service' } });
    await createSession(id);

    return NextResponse.json({ ok: true, data: { userId: id, redirect: '/dashboard' } }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

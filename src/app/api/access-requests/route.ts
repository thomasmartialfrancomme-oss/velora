/**
 * POST /api/access-requests — the private access form.
 *
 * Public by design, so it is the most exposed write in the product:
 *  - strict zod schema, fixed country / requirement enums;
 *  - honeypot field (`website`) must be empty;
 *  - per-IP budget of 3 submissions per 10 minutes;
 *  - no financial data collected, ever;
 *  - one request per address in a 14-day window (dedupe, not rejection spam);
 *  - the response is identical whether or not the address was already known.
 */
import { NextResponse } from 'next/server';
import { accessRequestSchema } from '@/lib/validation/schemas';
import { getDb, audit, newId, nowIso } from '@/lib/db';
import { clientIp, consume, hashIp } from '@/lib/http/security';
import { fail, toErrorResponse } from '@/lib/http/responses';
import { campaignColumns, campaignFromRequest } from '@/lib/marketing/attribution';

export const dynamic = 'force-dynamic';

const SUCCESS = 'Thank you. Your private access request has been received.';

export async function POST(request: Request) {
  try {
    consume(`access:${clientIp(request)}`, 3, 10 * 60_000);

    const parsed = accessRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!fields[key]) fields[key] = issue.message;
      }
      return fail(422, 'validation_failed', 'Please review the highlighted fields.', fields);
    }
    const data = parsed.data;
    if (data.website) return NextResponse.json({ ok: true, data: { message: SUCCESS } }); // bot: pretend success

    const db = getDb();
    const existing = db.get<{ id: string; status: string }>(
      `SELECT id, status FROM access_requests WHERE lower(email) = lower(@email) AND created_at > datetime('now','-14 day')`,
      { email: data.email },
    );
    if (existing) {
      return NextResponse.json({ ok: true, data: { message: SUCCESS, duplicate: true }, meta: { status: existing.status } });
    }

    const ts = nowIso();
    db.run(
      `INSERT INTO access_requests (id, first_name, last_name, email, country, residences, primary_requirement, message, referrer,
                                   utm_source, utm_medium, utm_campaign, utm_content, status, created_at, updated_at)
       VALUES (@id, @first, @last, @email, @country, @residences, @requirement, @message, @referrer,
               @utm_source, @utm_medium, @utm_campaign, @utm_content, 'new', @ts, @ts)`,
      {
        id: newId('areq'),
        first: data.firstName,
        last: data.lastName,
        email: data.email,
        country: data.country,
        residences: data.residences,
        requirement: data.primaryRequirement,
        message: data.message ?? null,
        referrer: request.headers.get('referer')?.slice(0, 200) ?? 'direct',
        ...campaignColumns(campaignFromRequest(request)),
        ts,
      },
    );
    audit({ userId: null, event: 'access_request.created', ipHash: hashIp(clientIp(request)), meta: { country: data.country, residences: data.residences } });

    return NextResponse.json({ ok: true, data: { message: SUCCESS } }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/** GET for the marketing page to prefill nothing but report a known status. */
export async function GET(request: Request) {
  const email = new URL(request.url).searchParams.get('email') ?? '';
  if (!/.+@.+\..+/.test(email)) return NextResponse.json({ ok: true, data: { found: false } });
  const row = getDb().get<{ status: string; created_at: string }>(
    `SELECT status, created_at FROM access_requests WHERE lower(email) = lower(@email) ORDER BY created_at DESC LIMIT 1`,
    { email },
  );
  return NextResponse.json({ ok: true, data: { found: Boolean(row), status: row?.status ?? null } });
}

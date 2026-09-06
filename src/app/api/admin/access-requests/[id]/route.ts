/** PATCH /api/admin/access-requests/[id] — triage a private access request. */
import { api } from '@/lib/http/handler';
import { adminAccessRequestSchema } from '@/lib/validation/schemas';
import { updateAccessRequest } from '@/lib/data/admin';
import { audit, getDb, newId, nowIso } from '@/lib/db';
import { randomToken, sha256 } from '@/lib/auth/password';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'admin:access-request',
  auth: 'admin',
  schema: adminAccessRequestSchema,
  handler: ({ user, params, body }) => {
    const row = getDb().get<{
      id: string;
      email: string;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_content: string | null;
    }>(
      `SELECT id, email, utm_source, utm_medium, utm_campaign, utm_content FROM access_requests WHERE id = @id`,
      { id: params.id },
    );
    if (!row) return fail(404, 'not_found', 'That request does not exist.');
    const patch = body as { status: 'new' | 'reviewing' | 'invited' | 'declined' | 'archived'; reviewerNote?: string | null };
    updateAccessRequest(params.id, patch.status, patch.reviewerNote ?? null);
    audit({ userId: user.id, event: 'admin.access_request_updated', target: params.id, meta: { status: patch.status } });

    // Inviting creates an unusable placeholder account with a reset link: the
    // principal chooses their own passphrase. No password is ever generated
    // on someone's behalf and emailed.
    let invite: { email: string; link: string } | null = null;
    if (patch.status === 'invited') {
      const db = getDb();
      const existing = db.get<{ id: string }>(`SELECT id FROM users WHERE lower(email) = lower(@email)`, { email: row.email });
      const token = randomToken(24);
      if (!existing) {
        db.run(
          `INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, country, timezone, locale, currency, briefing_time, notifications_json,
                              utm_source, utm_medium, utm_campaign, utm_content, created_at, updated_at)
           VALUES (@id, @email, @hash, 'VELORA', 'Invite', 'owner', 'invited', NULL, 'Europe/Paris', 'en-GB', 'EUR', '07:00', '{}',
                   @utm_source, @utm_medium, @utm_campaign, @utm_content, @ts, @ts)`,
          {
            id: newId('usr'),
            email: row.email.toLowerCase(),
            hash: `unusable:${token}`,
            // The advert that produced this request keeps paying for as long as the
            // account it created is quoted — the campaign follows the applicant in.
            utm_source: row.utm_source,
            utm_medium: row.utm_medium,
            utm_campaign: row.utm_campaign,
            utm_content: row.utm_content,
            ts: nowIso(),
          },
        );
      }
      db.run(
        `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at)
         VALUES (@id, (SELECT id FROM users WHERE lower(email) = lower(@email)), @hash, @exp, @ts)`,
        { id: newId('rst'), email: row.email, hash: require('node:crypto').createHash('sha256').update(`velora:${token}`).digest('hex'), exp: new Date(Date.now() + 14 * 86_400_000).toISOString(), ts: nowIso() },
      );
      invite = { email: row.email, link: `/forgot-password?token=${token}&invited=1` };
    }

    return { updated: true, invite };
  },
});

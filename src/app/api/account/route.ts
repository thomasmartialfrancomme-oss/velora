/** PATCH /api/account — profile fields a principal may change. Email is not one of them. */
import { api } from '@/lib/http/handler';
import { profileSchema } from '@/lib/validation/schemas';
import { getDb, audit, nowIso } from '@/lib/db';
import { syncLocaleCookie } from '@/lib/auth/session';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'account:read',
  handler: ({ user }) => user,
});

export const PATCH = api({
  scope: 'account:update',
  schema: profileSchema,
  handler: ({ user, body }) => {
    const data = body as Record<string, string | undefined>;
    if ((body as Record<string, unknown>).email !== undefined) {
      return fail(400, 'immutable_field', 'Your address is changed by your coordinator, never from the form.');
    }
    getDb().run(
      `UPDATE users SET first_name = @first, last_name = @last, country = @country, timezone = @tz,
              locale = @locale, currency = @currency, briefing_time = @briefing,
              avatar_initials = @initials, updated_at = @ts
        WHERE id = @id`,
      {
        first: data.firstName ?? user.firstName,
        last: data.lastName ?? user.lastName,
        country: data.country || null,
        tz: data.timezone ?? user.timezone,
        locale: data.locale ?? user.locale,
        currency: data.currency ?? user.currency,
        briefing: data.briefingTime ?? user.briefingTime,
        initials: `${(data.firstName ?? user.firstName)[0] ?? ''}${(data.lastName ?? user.lastName)[0] ?? ''}`.toUpperCase(),
        ts: nowIso(),
        id: user.id,
      },
    );
    audit({ userId: user.id, event: 'account.updated' });
    const fresh = getDb().get<{ locale: string; timezone: string; currency: string }>(
      `SELECT locale, timezone, currency FROM users WHERE id = @id`,
      { id: user.id },
    );
    if (fresh) syncLocaleCookie(fresh.locale);
    // Le formulaire de réglages relit l'état depuis la base : renvoyer la ligne fraîche
    // coûte un SELECT et évite d'afficher la valeur d'avant l'enregistrement.
    return { updated: true, ...(fresh ?? {}) };
  },
});

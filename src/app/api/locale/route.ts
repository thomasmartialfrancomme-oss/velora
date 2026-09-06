/**
 * POST /api/locale — choose the language of the interface.
 *
 * Available signed out (the marketing site, the sign-in screen) and signed in.
 * When a member is signed in, the same value is written to their profile, so the
 * choice follows them to another device rather than living in one cookie.
 *
 * The cookie is HttpOnly: the browser side never reads it — the root layout
 * resolves the locale once and hands it to the client tree through context, so a
 * script on the page cannot tamper with what a member is shown.
 */
import { z } from 'zod';
import { cookies } from 'next/headers';
import { api } from '@/lib/http/handler';
import { getCurrentUser } from '@/lib/auth/session';
import { audit, getDb, nowIso } from '@/lib/db';
import { LOCALE_COOKIE, intlLocale, LOCALES, type Locale } from '@/lib/i18n/locales';

export const dynamic = 'force-dynamic';

const schema = z.object({ locale: z.enum(LOCALES) });

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // A language preference is not a secret and not perishable.
  maxAge: 60 * 60 * 24 * 365,
});

export const POST = api({
  scope: 'locale:set',
  auth: 'public',
  schema,
  limit: { max: 120, windowMs: 60_000 },
  handler: async ({ body }) => {
    const locale = (body as { locale: Locale }).locale;
    cookies().set(LOCALE_COOKIE, locale, cookieOptions());

    const user = await getCurrentUser();
    if (user && user.locale !== intlLocale(locale)) {
      getDb().run(`UPDATE users SET locale = @locale, updated_at = @ts WHERE id = @id`, {
        locale: intlLocale(locale),
        ts: nowIso(),
        id: user.id,
      });
      audit({ userId: user.id, event: 'account.language_changed', meta: { locale } });
    }

    return { locale, savedToProfile: Boolean(user) };
  },
});

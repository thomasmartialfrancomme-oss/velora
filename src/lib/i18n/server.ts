/**
 * Locale resolution on the server.
 *
 * Order of precedence:
 *   1. the `velora_locale` cookie — set explicitly by the language switcher, by
 *      the profile form, and mirrored from the signed-in member's stored
 *      preference at login, so a returning member lands in their own language on
 *      any device;
 *   2. `Accept-Language`, honouring q-values (a French browser gets French with
 *      no interaction at all);
 *   3. English, the language the interface was authored in.
 *
 * Everything here reads request state, so it may only be called from Server
 * Components and Route Handlers — client components use `useT()` from
 * `src/lib/i18n/context.tsx`, which is fed by the root layout.
 */
import { cookies, headers } from 'next/headers';
import { dictionaries } from './dictionaries';
import { DEFAULT_LOCALE, fromAcceptLanguage, intlLocale, isLocale, LOCALE_COOKIE, LOCALE_META, type Locale } from './locales';
import { translate, type Vars } from './translate';

export function requestLocale(): Locale {
  try {
    const cookieValue = cookies().get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieValue)) return cookieValue;
  } catch {
    /* no cookie store during static generation */
  }
  try {
    const fromHeader = fromAcceptLanguage(headers().get('accept-language'));
    if (fromHeader) return fromHeader;
  } catch {
    /* ditto */
  }
  return DEFAULT_LOCALE;
}

export function localeTable(locale: Locale = requestLocale()): Record<string, string> {
  return dictionaries[locale] ?? {};
}

/** `(source, vars?) => string`, bound to the request's language. */
export function getT(locale: Locale = requestLocale()): (source: string, vars?: Vars) => string {
  return (source, vars) => translate(locale, source, vars);
}

export function localeMeta(locale: Locale = requestLocale()) {
  return { locale, ...LOCALE_META[locale], intl: intlLocale(locale) };
}

export { LOCALE_COOKIE, type Locale };

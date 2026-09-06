/**
 * Languages VELORA speaks.
 *
 * The interface is authored in English — that is the language of the copy in the
 * marketing pages and of every label in the code. Translation is a lookup keyed
 * on that English source text (gettext style), so a string never needs a key to
 * be invented and kept in sync: the code holds the source of truth, the
 * dictionary holds the equivalents, and an untranslated string falls back to
 * English rather than rendering an error or an empty cell.
 */
export const LOCALES = ['en', 'fr', 'de', 'it', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

/** Language the interface falls back to when a dictionary has no entry. */
export const SOURCE_LOCALE: Locale = 'en';

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_META: Record<Locale, { label: string; native: string; htmlLang: string; dir: 'ltr' | 'rtl' }> = {
  en: { label: 'English', native: 'English', htmlLang: 'en', dir: 'ltr' },
  fr: { label: 'French', native: 'Français', htmlLang: 'fr', dir: 'ltr' },
  de: { label: 'German', native: 'Deutsch', htmlLang: 'de', dir: 'ltr' },
  it: { label: 'Italian', native: 'Italiano', htmlLang: 'it', dir: 'ltr' },
  es: { label: 'Spanish', native: 'Español', htmlLang: 'es', dir: 'ltr' },
};

/** Cookie that carries the choice for visitors who are not signed in. */
export const LOCALE_COOKIE = 'velora_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function coerceLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** `Accept-Language: fr-FR,fr;q=0.9,en;q=0.8` → `fr`. */
export function fromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: (tag ?? '*').toLowerCase(), weight: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.weight - a.weight);
  for (const entry of ranked) {
    const base = entry.tag.split('-')[0];
    if (base && isLocale(base) && base !== SOURCE_LOCALE) return base;
  }
  return null;
}

/**
 * `users.locale` stores a BCP-47 tag (it also drives date and number
 * formatting), the interface speaks the short code. Both directions are derived,
 * never stored twice, so the profile form and the language switcher can never
 * disagree about which language a member is in.
 */
export function fromBcp47(tag: string | null | undefined): Locale | null {
  if (!tag) return null;
  const base = tag.toLowerCase().split('-')[0];
  return isLocale(base) ? base : null;
}

/** BCP-47 tag for Intl formatting, derived from the UI locale. */
export function intlLocale(locale: Locale): string {
  return { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', es: 'es-ES' }[locale];
}

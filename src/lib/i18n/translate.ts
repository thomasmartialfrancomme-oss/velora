import { dictionaries } from './dictionaries';
import { SOURCE_LOCALE, type Locale } from './locales';

export type Vars = Record<string, string | number | null | undefined>;

/** `{n}` placeholders in a translated string, substituted from `vars`. */
export function formatVars(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars && vars[key] !== undefined && vars[key] !== null ? String(vars[key]) : match));
}

/**
 * One lookup, one fallback. Unknown string → the English source, which is what
 * the interface was written in: a missing translation is a gap in a dictionary,
 * never a broken screen.
 */
export function translate(locale: Locale, source: string, vars?: Vars): string {
  if (locale === SOURCE_LOCALE) return formatVars(source, vars);
  const table = dictionaries[locale];
  return formatVars(table?.[source] ?? source, vars);
}

export function translatorFor(locale: Locale) {
  return (source: string, vars?: Vars) => translate(locale, source, vars);
}

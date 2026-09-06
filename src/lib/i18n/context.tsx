'use client';

import { createContext, useContext, useMemo } from 'react';
import { DEFAULT_LOCALE, type Locale } from './locales';
import { formatVars, translate, type Vars } from './translate';

type Value = { locale: Locale; table: Record<string, string> };

const I18nContext = createContext<Value>({ locale: DEFAULT_LOCALE, table: {} });

/**
 * Mounted once in the root layout with the language the server resolved, so the
 * interactive parts of the interface (forms, the palette, the upload dropzone, the
 * marketing hero) translate from the same table and the same fallback rule as the
 * server chrome. Only the active language's table crosses the boundary — a member
 * reading French downloads French, not every language in the repository.
 */
export function I18nProvider({ locale, table, children }: { locale: Locale; table?: Record<string, string>; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, table: table ?? {} }), [locale, table]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}

export function useTable(): Record<string, string> {
  return useContext(I18nContext).table;
}

/** `(source, vars?) => string` for client components. */
export function useT(): (source: string, vars?: Vars) => string {
  const { locale, table } = useContext(I18nContext);
  return useMemo(
    () => ((source, vars) => formatVars(table[source] ?? (locale === 'en' ? source : translate(locale, source)), vars)),
    [locale, table],
  );
}

/**
 * A translated leaf that Server Components may also render. This is what lets a
 * component used in both trees — a status pill, say — carry its own translation
 * without either side having to know where it was mounted.
 */
export function L10n({ source, vars, className }: { source: string; vars?: Vars; className?: string }) {
  const T = useT();
  const text = T(source, vars);
  if (className) return <span className={className}>{text}</span>;
  return <>{text}</>;
}

/**
 * The same leaf for display copy that carries its own line breaks: one translated
 * string in, one stacked line out. A headline authored as two lines in English is
 * still two lines in a language that needs four words where English needs three.
 */
export function L10nLines({ source, className }: { source: string; className?: string }) {
  const T = useT();
  return (
    <>
      {T(source)
        .split('\n')
        .map((line, index) => (
          <span key={index} className={index ? 'block' : undefined}>
            {line}
          </span>
        ))}
    </>
  );
}

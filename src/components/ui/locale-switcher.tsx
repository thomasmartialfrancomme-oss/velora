'use client';

import { useId, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import { LOCALES, LOCALE_META, type Locale } from '@/lib/i18n/locales';
import { cn } from '@/lib/utils/format';

/**
 * The language control. Written as a list of plain buttons rather than a
 * dropdown: on a sign-in screen and in a footer, two clicks should never be
 * needed to get back to your own language.
 *
 * Only `en`, `fr`, `de`, `it` and `es` are offered because only those are
 * installed as interface dictionaries — a language with no table is not offered,
 * it is simply not there. `npm run i18n:coverage` prints what each one covers.
 */
export function LocaleSwitcher({
  current,
  className,
  compact = false,
}: {
  current: Locale;
  className?: string;
  /** footer and top bar: native names only, no label */
  compact?: boolean;
}) {
  const router = useRouter();
  const T = useT();
  const labelId = useId();
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);

  function choose(locale: Locale) {
    if (locale === current) return;
    setFailed(false);
    start(async () => {
      const response = await fetch('/api/locale', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) {
        setFailed(true);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5', className)}>
      {!compact ? <span id={labelId} className="label text-graphite-500">{T('Language')}</span> : null}
      <ul className="flex flex-wrap items-center gap-x-2.5 gap-y-1" role="group" aria-labelledby={compact ? undefined : labelId}>
        {LOCALES.map((locale, index) => {
          const active = locale === current;
          return (
            <li key={locale} className="flex items-center gap-2.5">
              {index > 0 ? <span aria-hidden className="h-3 w-px bg-ivory-200/10" /> : null}
              <button
                type="button"
                onClick={() => choose(locale)}
                aria-pressed={active}
                disabled={pending}
                className={cn(
                  'text-[11px] uppercase tracking-[0.16em] transition-colors duration-300 disabled:opacity-60',
                  active ? 'text-gold-200 underline decoration-gold-400/40 underline-offset-4' : 'text-graphite-400 hover:text-ivory-100',
                )}
              >
                {LOCALE_META[locale].native}
              </button>
            </li>
          );
        })}
      </ul>
      {failed ? <span className="text-[11px] text-state-risk">{T('Could not be saved — try again.')}</span> : null}
    </div>
  );
}

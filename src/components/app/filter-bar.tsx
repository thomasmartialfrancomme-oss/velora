'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

export type FilterDef =
  | { key: string; label: string; type: 'search'; placeholder?: string }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] };

/**
 * Filters that live in the URL, so every view is linkable and the actual
 * filtering happens on the server against the member's own records.
 */
export function FilterBar({ filters, resultCount }: { filters: FilterDef[]; resultCount?: string }) {
  const T = useT();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(() => params.get('q') ?? '');
  const timer = useRef<number | null>(null);

  const push = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    // keep the field honest when the URL changes elsewhere (palette, back)
    const current = params.get('q') ?? '';
    setTerm((value) => (value === current ? value : current));
  }, [params]);

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const current = params.get('q') ?? '';
      if (term.trim() !== current) push('q', term.trim());
    }, 260);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const active = filters.some((filter) => {
    const value = params.get(filter.key) ?? '';
    return Boolean(value) && !(filter.type === 'select' && value === 'all');
  });

  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-4 border-b border-ivory-200/[0.07] pb-4">
      {filters.map((filter) => {
        if (filter.type === 'search') {
          return (
            <div key={filter.key} className="flex min-w-[200px] flex-1 items-center gap-2.5 sm:max-w-[320px]">
              <Search size={13} strokeWidth={1.4} className="shrink-0 text-graphite-500" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder={T(filter.placeholder ?? filter.label)}
                aria-label={T(filter.label)}
                className="w-full border-b border-transparent bg-transparent pb-1.5 text-[13px] text-ivory-50 outline-none transition-colors duration-300 placeholder:text-graphite-600 focus:border-gold-400/50"
              />
            </div>
          );
        }
        const value = params.get(filter.key) ?? 'all';
        return (
          <label key={filter.key} className="flex items-center gap-2.5">
            <span className="text-[10px] uppercase tracking-[0.2em] text-graphite-600">{T(filter.label)}</span>
            <select
              value={value}
              onChange={(event) => push(filter.key, event.target.value)}
              className={cn(
                'cursor-pointer appearance-none border-b border-ivory-200/12 bg-transparent pb-1.5 pr-5 text-[12.5px] text-ivory-100 outline-none transition-colors duration-300 hover:border-ivory-200/25 focus:border-gold-400/60',
                value !== 'all' && 'text-gold-200',
              )}
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%236E747E' stroke-width='1'/></svg>\")",
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right center',
              }}
            >
              {filter.options.map((option) => (
                <option key={option.value} value={option.value} className="bg-ink-900 text-ivory-100">
                  {T(option.label)}
                </option>
              ))}
            </select>
          </label>
        );
      })}

      <div className="ml-auto flex items-center gap-4">
        {resultCount ? <span className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-600">{resultCount}</span> : null}
        {active ? (
          <button
            type="button"
            onClick={() => router.replace(pathname, { scroll: false })}
            className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.18em] text-graphite-400 transition-colors hover:text-ivory-100"
          >
            <X size={11} strokeWidth={1.6} />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}

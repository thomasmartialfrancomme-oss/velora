'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils/format';

/**
 * Tabs that write to the URL (?tab=people) so a view can be shared or
 * reloaded — server-rendered content stays in sync with the control.
 */
export function Tabs({
  tabs,
  paramKey = 'tab',
  className,
  value,
  onChange,
}: {
  tabs: { value: string; label: string; count?: number }[];
  paramKey?: string;
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = value ?? searchParams.get(paramKey) ?? tabs[0]?.value ?? '';

  const select = useCallback(
    (next: string) => {
      if (onChange) {
        onChange(next);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set(paramKey, next);
      router.replace(`${window.location.pathname}?${params.toString()}`, { scroll: false });
    },
    [onChange, paramKey, router, searchParams],
  );

  return (
    <div className={cn('relative -mx-1 flex gap-1 overflow-x-auto border-b border-ivory-200/[0.08] px-1 no-scrollbar', className)} role="tablist">
      {tabs.map((tab) => {
        const active = tab.value === current;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => select(tab.value)}
            className={cn(
              'relative shrink-0 px-4 py-3 text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 ease-lux',
              active ? 'text-ivory-50' : 'text-graphite-400 hover:text-ivory-200',
            )}
          >
            <span className="flex items-center gap-2">
              {tab.label}
              {tab.count !== undefined ? (
                <span className={cn('text-[10px] tabular-nums', active ? 'text-gold-300' : 'text-graphite-500')}>{tab.count}</span>
              ) : null}
            </span>
            {active ? (
              <motion.span
                layoutId={`tab-underline-${paramKey}`}
                className="absolute inset-x-3 -bottom-px h-px bg-gold-400/80"
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

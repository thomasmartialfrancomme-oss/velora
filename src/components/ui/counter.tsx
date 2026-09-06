'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/format';

/**
 * Number counter. Eased (not linear) so it reads as measured rather than as a
 * slot machine, and it only runs once the element is actually on screen.
 */
export function Counter({
  value,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
  separator = true,
  startOnView = true,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  separator?: boolean;
  startOnView?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(startOnView ? 0 : value);
  const [running, setRunning] = useState(!startOnView);
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (!startOnView || reduced) {
      setDisplay(value);
      return;
    }
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setRunning(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [startOnView, reduced]);

  useEffect(() => {
    if (!running) return;
    if (reduced) {
      setDisplay(value);
      return;
    }
    let frame = 0;
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 4);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, value, duration, reduced]);

  const formatted = separator
    ? display.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : display.toFixed(decimals);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

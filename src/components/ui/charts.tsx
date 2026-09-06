'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cn, formatMoney } from '@/lib/utils/format';

/**
 * How a chart should speak about its numbers. Values are described, never
 * handed over as a closure: these components render inside the client tree, and
 * React refuses to serialise a function sent from a Server Component
 * (“Functions cannot be passed directly to Client Components”), which fails the
 * page in production while dev tolerates it. `kind: 'money'` therefore expects
 * cents, exactly like `formatMoney`.
 */
export type ChartValueFormat = { kind: 'plain' } | { kind: 'money'; currency: string; compact?: boolean };

function formatterFor(format: ChartValueFormat | undefined): (value: number) => string {
  if (format?.kind === 'money') {
    const { currency, compact } = format;
    return (cents) => formatMoney(cents, { currency, compact });
  }
  return (value) => String(Math.round(value));
}

/**
 * Hand-drawn SVG charts: no charting dependency, no default palette, and the
 * hairline geometry of the rest of the product. Bars grow when the block
 * enters the viewport; lines draw themselves.
 */
export function BarChart({
  data,
  height = 190,
  format,
  tone = 'gold',
  className,
}: {
  data: { label: string; value: number; hint?: string }[];
  height?: number;
  format?: ChartValueFormat;
  tone?: 'gold' | 'ivory';
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const render = formatterFor(format);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => entries.some((entry) => entry.isIntersecting) && setVisible(true),
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn('w-full', className)}>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {data.map((item, index) => {
          const ratio = item.value / max;
          return (
            <div key={`${item.label}-${index}`} className="group flex h-full flex-1 flex-col justify-end gap-2.5">
              <span
                className={cn(
                  'text-center text-[10.5px] tabular-nums transition-opacity duration-500',
                  visible ? 'opacity-100' : 'opacity-0',
                  tone === 'gold' ? 'text-gold-200/85' : 'text-ivory-200/80',
                )}
              >
                {render(item.value)}
              </span>
              <div
                className={cn(
                  'relative w-full origin-bottom rounded-t-[2px] transition-all duration-[1100ms] ease-lux',
                  tone === 'gold'
                    ? 'bg-gradient-to-t from-gold-400/15 via-gold-400/45 to-gold-300/70 group-hover:to-gold-200'
                    : 'bg-gradient-to-t from-ivory-100/10 via-ivory-100/30 to-ivory-100/55',
                )}
                style={{ height: visible ? `${Math.max(2, ratio * 100)}%` : '0%', transitionDelay: `${index * 70}ms` }}
              >
                <span className="absolute inset-x-0 top-0 h-px bg-ivory-50/40" />
              </div>
              <span className="truncate text-center text-[10px] uppercase tracking-[0.14em] text-graphite-400">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LineChart({
  points,
  labels = [],
  height = 150,
  format,
  className,
}: {
  points: number[];
  labels?: string[];
  height?: number;
  format?: ChartValueFormat;
  className?: string;
}) {
  const gradientId = useId();
  const [visible, setVisible] = useState(false);
  const ref = useRef<SVGSVGElement>(null);
  const render = formatterFor(format);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setVisible(true), { threshold: 0.2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) return null;

  const width = 520;
  const padding = 12;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = Math.max(1, max - min);
  const step = (width - padding * 2) / (points.length - 1);
  const coordinates = points.map((value, index) => ({
    x: padding + index * step,
    y: padding + (1 - (value - min) / span) * (height - padding * 2),
    value,
  }));

  const line = coordinates.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coordinates[coordinates.length - 1]!.x.toFixed(1)},${height - padding} L${coordinates[0]!.x.toFixed(1)},${height - padding} Z`;
  const last = coordinates[coordinates.length - 1]!;

  return (
    <div className={cn('w-full', className)}>
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Monthly trend">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(201 169 106)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="rgb(201 169 106)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line key={ratio} x1={padding} x2={width - padding} y1={padding + ratio * (height - padding * 2)} y2={padding + ratio * (height - padding * 2)} stroke="rgba(238,232,219,0.06)" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#${gradientId})`} opacity={visible ? 1 : 0} style={{ transition: 'opacity 900ms ease' }} />
        <path
          d={line}
          fill="none"
          stroke="rgb(213 185 133)"
          strokeWidth="1.35"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={visible ? 0 : 1}
          style={{ transition: 'stroke-dashoffset 1600ms cubic-bezier(0.16,1,0.3,1)' }}
        />
        {coordinates.map((point, index) => (
          <g key={index}>
            <circle cx={point.x} cy={point.y} r={index === coordinates.length - 1 ? 2.8 : 1.8} fill={index === coordinates.length - 1 ? 'rgb(240 227 205)' : 'rgb(201 169 106)'} opacity={visible ? 1 : 0} style={{ transition: `opacity 500ms ease ${400 + index * 90}ms` }} />
            <title>{`${labels[index] ?? ''} ${render(point.value)}`}</title>
          </g>
        ))}
        <text x={last.x} y={Math.max(12, last.y - 10)} textAnchor="end" className="fill-ivory-100 text-[10px]" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {render(last.value)}
        </text>
      </svg>
      {labels.length ? (
        <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.14em] text-graphite-500">
          {labels.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function CompositionBar({ segments, className }: { segments: { label: string; value: number; tone: string }[]; className?: string }) {
  const total = Math.max(1, segments.reduce((sum, segment) => sum + segment.value, 0));
  const toneClass: Record<string, string> = {
    gold: 'bg-gold-400/80',
    ivory: 'bg-ivory-200/70',
    graphite: 'bg-graphite-400/70',
    steel: 'bg-state-info/70',
    sage: 'bg-state-ok/70',
  };
  return (
    <div className={className}>
      <div className="flex h-[6px] w-full overflow-hidden rounded-full bg-ink-800">
        {segments.map((segment, index) => (
          <span
            key={`${segment.label}-${index}`}
            className={cn('h-full transition-all duration-[1200ms] ease-lux', toneClass[segment.tone] ?? 'bg-graphite-500')}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}`}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment, index) => (
          <span key={`${segment.label}-legend-${index}`} className="flex items-center gap-2 text-[11px] text-graphite-300">
            <span className={cn('h-1.5 w-1.5 rounded-full', toneClass[segment.tone] ?? 'bg-graphite-500')} />
            {segment.label}
            <span className="tabular-nums text-graphite-500">{Math.round((segment.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { cn } from '@/lib/utils/format';

/**
 * The chrome shared by every screen inside the member area: a quiet header,
 * a ledger-style stat strip, and notice blocks that are honest about what the
 * platform could and could not do.
 */

export function PageHeader({
  eyebrow,
  title,
  lede,
  meta,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-7 border-b border-ivory-200/[0.07] pb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="label mb-4 text-gold-300/80">{eyebrow}</p> : null}
        <h1 className="font-serif text-[clamp(1.85rem,3.4vw,2.65rem)] font-light uppercase leading-[1.08] tracking-[0.04em] text-ivory-50">{title}</h1>
        {lede ? <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-graphite-400">{lede}</p> : null}
        {meta ? <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-graphite-500">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
    </header>
  );
}

export function StatStrip({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode; detail?: string; href?: string; tone?: 'default' | 'gold' | 'attention' | 'ok' }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item) => {
        const body = (
          <>
            <p className="label text-graphite-500">{item.label}</p>
            <p
              className={cn(
                'mt-3 font-serif text-[1.75rem] font-light leading-none tabular-nums',
                item.tone === 'gold' ? 'text-gold-200' : item.tone === 'attention' ? 'text-state-warn' : item.tone === 'ok' ? 'text-state-ok' : 'text-ivory-50',
              )}
            >
              {item.value}
            </p>
            {item.detail ? <p className="mt-2.5 text-[11.5px] leading-relaxed text-graphite-500">{item.detail}</p> : null}
          </>
        );
        return item.href ? (
          <Link key={item.label} href={item.href} className="group bg-ink-950 p-5 transition-colors duration-400 ease-lux hover:bg-ink-900/80">
            {body}
          </Link>
        ) : (
          <div key={item.label} className="bg-ink-950 p-5">
            {body}
          </div>
        );
      })}
    </div>
  );
}

export function KeyValue({ items, className }: { items: { label: string; value: React.ReactNode }[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-ivory-200/[0.06]', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-6 py-2.5">
          <dt className="text-[11.5px] uppercase tracking-[0.14em] text-graphite-500">{item.label}</dt>
          <dd className="min-w-0 text-right text-[13px] text-ivory-100">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A status line that never overstates what happened. */
export function Notice({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'attention' | 'ok' | 'risk';
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const styles = {
    info: 'border-ivory-200/[0.09] bg-ink-900/50 text-graphite-300',
    attention: 'border-gold-400/30 bg-gold-400/[0.05] text-gold-100',
    ok: 'border-state-ok/30 bg-state-ok/[0.05] text-ivory-100',
    risk: 'border-state-risk/35 bg-state-risk/[0.06] text-ivory-100',
  }[tone];

  const dot = {
    info: 'bg-graphite-400',
    attention: 'bg-gold-400',
    ok: 'bg-state-ok',
    risk: 'bg-state-risk',
  }[tone];

  return (
    <div className={cn('rounded-[5px] border px-5 py-4', styles)}>
      <p className="flex items-start gap-3 text-[13px] leading-relaxed">
        <span className={cn('mt-[7px] h-[5px] w-[5px] shrink-0 rounded-full', dot)} />
        <span className="min-w-0">
          <span className="text-ivory-50">{title}</span>
          {children ? <span className="mt-1.5 block text-[12.5px] leading-relaxed text-graphite-400">{children}</span> : null}
        </span>
      </p>
      {action ? <div className="mt-3.5 flex flex-wrap gap-2.5 pl-8">{action}</div> : null}
    </div>
  );
}

/** Small right-aligned count used in panel headers. */
export function CountNote({ children }: { children: React.ReactNode }) {
  return <span className="text-[10.5px] uppercase tracking-[0.18em] text-graphite-500">{children}</span>;
}

export function FooterNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-[11.5px] leading-relaxed text-graphite-600">{children}</p>;
}

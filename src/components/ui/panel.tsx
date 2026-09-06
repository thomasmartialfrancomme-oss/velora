import { cn } from '@/lib/utils/format';
import { L10n } from '@/lib/i18n/context';;

export function Panel({
  children,
  className,
  as: Tag = 'div',
  hover = false,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'li' | 'aside';
  hover?: boolean;
  padded?: boolean;
}) {
  return (
    <Tag
      className={cn(
        'relative rounded-[5px] border border-ivory-200/[0.07] bg-ink-900/55',
        padded && 'p-5 sm:p-6',
        hover && 'transition-all duration-500 ease-lux hover:border-ivory-200/[0.16] hover:bg-ink-850/70',
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function PanelHeader({
  label,
  title,
  description,
  actions,
  className,
}: {
  label?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        {label ? <p className="label mb-2">{<L10n source={label} />}</p> : null}
        <h2 className="font-serif text-[1.35rem] leading-tight text-ivory-100">{typeof title === 'string' ? <L10n source={title} /> : title}</h2>
        {description ? <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-graphite-300">{typeof description === 'string' ? <L10n source={description} /> : description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  const label = typeof children === 'string' ? <L10n source={children} /> : children;
  return <p className={cn('label', className)}>{label}</p>;
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-gradient-to-r from-transparent via-ivory-200/[0.12] to-transparent', className)} />;
}

/** A ledger-style key/value row — used everywhere instead of boxed stat cards. */
export function LedgerRow({
  label,
  value,
  detail,
  tone = 'default',
  action,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  detail?: React.ReactNode;
  tone?: 'default' | 'attention' | 'ok' | 'muted';
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'group flex items-baseline justify-between gap-4 border-b border-ivory-200/[0.06] py-3 last:border-b-0',
        'transition-colors duration-300 ease-lux hover:bg-ivory-100/[0.015]',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.2em] text-graphite-400">{label}</p>
        {detail ? <p className="mt-1 truncate text-[12.5px] text-graphite-300">{detail}</p> : null}
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'text-right font-serif text-[1.05rem] tabular-nums',
            tone === 'attention' && 'text-gold-200',
            tone === 'ok' && 'text-state-ok',
            tone === 'muted' && 'text-graphite-300',
            tone === 'default' && 'text-ivory-100',
          )}
        >
          {value}
        </span>
        {action}
      </div>
    </div>
  );
}

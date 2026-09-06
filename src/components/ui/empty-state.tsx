import { cn } from '@/lib/utils/format';

/** Nothing in the product is ever allowed to render as a blank rectangle. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  compact = false,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[5px] border border-dashed border-ivory-200/12 bg-ink-900/25 text-center',
        compact ? 'px-5 py-8' : 'px-6 py-14',
        className,
      )}
    >
      {icon ? <div className="mb-4 text-graphite-400">{icon}</div> : null}
      <p className="font-serif text-[1.1rem] text-ivory-100">{title}</p>
      {description ? <p className="mt-2 max-w-md text-[13px] leading-relaxed text-graphite-300">{description}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'That could not be loaded.', description, retry }: { title?: string; description?: string; retry?: React.ReactNode }) {
  return (
    <div className="rounded-[5px] border border-state-risk/25 bg-state-risk/[0.04] px-6 py-8 text-center">
      <p className="font-serif text-[1.1rem] text-ivory-100">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-graphite-300">{description}</p> : null}
      {retry ? <div className="mt-5 flex justify-center">{retry}</div> : null}
    </div>
  );
}

import { cn } from '@/lib/utils/format';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-hidden />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/5' : i % 2 === 0 ? 'w-full' : 'w-4/5')} />
      ))}
    </div>
  );
}

export function SkeletonPanel({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-[5px] border border-ivory-200/[0.06] bg-ink-900/40 p-6', className)} aria-hidden>
      <Skeleton className="mb-5 h-2.5 w-24" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-6 border-b border-ivory-200/[0.05] pb-3 last:border-b-0">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCards({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-3', className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-[5px] border border-ivory-200/[0.06] bg-ink-900/40 p-6">
          <Skeleton className="mb-4 h-2 w-16" />
          <Skeleton className="mb-2 h-5 w-2/3" />
          <Skeleton className="mb-6 h-3 w-1/3" />
          <div className="space-y-3">
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

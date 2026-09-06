import { Skeleton } from '@/components/ui/skeleton';

export default function GlobalLoading() {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-6 py-12 sm:px-10">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-6 h-10 w-[min(520px,70%)]" />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="mt-4 h-64" />
    </div>
  );
}

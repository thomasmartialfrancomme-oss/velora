'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[velora] unhandled view error', error);
  }, [error]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-ink-1000 px-6">
      <div className="w-full max-w-lg">
        <p className="label mb-6 text-gold-300/80">Something stopped</p>
        <h1 className="font-serif text-[2.1rem] font-light uppercase leading-[1.12] tracking-[0.04em] text-ivory-50">
          This view could not be drawn
        </h1>
        <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">
          The data behind it is untouched. Retry the view; if it happens again, the detail below is what an engineer will need.
        </p>
        {error?.message ? (
          <pre className="mt-6 overflow-x-auto rounded-[4px] border border-ivory-200/[0.09] bg-ink-950 px-4 py-3 text-[11.5px] leading-relaxed text-graphite-300">
            {error.message}
            {error.digest ? `\nref ${error.digest}` : ''}
          </pre>
        ) : null}
        <div className="mt-8 flex flex-wrap gap-3">
          <Button onClick={reset} size="md">
            Try again
          </Button>
          <Button asLink href="/dashboard" variant="secondary" size="md">
            Back to the dashboard
          </Button>
        </div>
        <p className="mt-8 text-[11px] uppercase tracking-[0.2em] text-graphite-600">
          Or <Link href="/support" className="text-graphite-300 transition-colors hover:text-ivory-100">raise it with the office</Link>
        </p>
      </div>
    </div>
  );
}

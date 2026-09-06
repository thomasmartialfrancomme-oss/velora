import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-ink-1000 px-6">
      <div className="w-full max-w-md text-center">
        <span className="mx-auto mb-9 block h-px w-12 bg-ivory-200/25" />
        <p className="label text-gold-300/80">Nothing here</p>
        <h1 className="mt-6 font-serif text-[2.4rem] font-light uppercase leading-[1.1] tracking-[0.05em] text-ivory-50">
          That page does not exist
        </h1>
        <p className="mt-5 text-[13.5px] leading-relaxed text-graphite-300">
          It may have been a link from an older build. The introduction, the membership tiers and your dashboard are all still where you left them.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          <Link href="/" className="text-[11px] uppercase tracking-[0.2em] text-ivory-100 transition-colors hover:text-gold-200">
            Introduction
          </Link>
          <Link href="/membership" className="text-[11px] uppercase tracking-[0.2em] text-graphite-300 transition-colors hover:text-gold-200">
            Membership
          </Link>
          <Link href="/dashboard" className="text-[11px] uppercase tracking-[0.2em] text-graphite-300 transition-colors hover:text-gold-200">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

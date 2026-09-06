import Link from 'next/link';
import { redirect } from 'next/navigation';
import { BrandLockup } from '@/components/brand';
import { getCurrentUser } from '@/lib/auth/session';
import { getT } from '@/lib/i18n/server';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const T = getT();
  // Anyone holding a session has no business on the door.
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <div className="relative grid min-h-svh lg:grid-cols-[1.05fr_0.95fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-ivory-200/[0.07] bg-ink-1000 px-14 py-14 lg:flex">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -left-40 top-1/2 h-[560px] w-[560px] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(201,169,106,0.09),transparent_65%)] blur-[10px]" />
        </div>
        <BrandLockup href="/" size="sm" />

        <div className="relative max-w-md">
          <span className="mb-9 block h-px w-16 bg-ivory-200/25" />
          <p className="font-serif text-[clamp(1.9rem,2.6vw,2.7rem)] font-light leading-[1.22] text-ivory-50">{T("The households that need this least")}<br />
            are the ones already running it.
          </p>
          <p className="mt-8 max-w-sm text-[13.5px] leading-relaxed text-graphite-300">{T("This is where your residences, your people, your travel and your ledger meet — behind one door, visible to no one else.")}</p>
          <ul className="mt-10 space-y-3">
            {['Per-member data isolation', 'No third-party trackers on this page', 'Sessions revoked the moment you ask'].map((item) => (
              <li key={item} className="flex items-center gap-3 text-[12.5px] text-graphite-400">
                <span className="h-[3px] w-[3px] rounded-full bg-gold-400/80" />
                {T(item)}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-end justify-between gap-6">
          <Link href="/" className="text-[11px] uppercase tracking-[0.2em] text-graphite-400 transition-colors hover:text-ivory-100">{T("← Return to the introduction")}</Link>
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-graphite-600">{T("VELORA PRIVATE")}</p>
        </div>
      </aside>

      <main id="main" className="relative flex items-center justify-center bg-ink-950 px-5 py-14 sm:px-10">
        <div className="absolute right-5 top-5 sm:right-10 sm:top-10">
          {/* The door is the one place a visitor may not yet have a profile to
              change — so the language is chosen here, before any of it. */}
          <LocaleSwitcher compact />
        </div>
        <div className="w-full max-w-[430px]">
          <div className="mb-10 lg:hidden">
            <BrandLockup href="/" size="sm" />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

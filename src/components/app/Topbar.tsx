'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, CreditCard, LifeBuoy, LogOut, Menu, Search, Settings2 } from 'lucide-react';
import { NotificationsBell } from '@/components/app/NotificationsBell';
import type { ShellUser } from '@/components/app/Sidebar';
import { titleForPath } from '@/components/app/nav';
import { apiRequest } from '@/lib/http/client';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

function LocalClock({ timeZone }: { timeZone: string }) {
  const T = useT();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const text = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).format(now);

  return (
    <span className="hidden items-baseline gap-2 xl:flex">
      <span className="text-[11px] tabular-nums text-ivory-100">{text}</span>
      <span className="text-[9.5px] uppercase tracking-[0.18em] text-graphite-600">{timeZone.split('/').pop()?.replace('_', ' ')}</span>
    </span>
  );
}

export function Topbar({
  user,
  unread,
  planName,
  onOpenMenu,
  onOpenPalette,
}: {
  user: ShellUser;
  unread: number;
  planName: string;
  onOpenMenu: () => void;
  onOpenPalette: () => void;
}) {
  const T = useT();
  const pathname = usePathname();
  const router = useRouter();
  const crumbs = titleForPath(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function signOut() {
    setSigningOut(true);
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login?signedOut=1');
      router.refresh();
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-ivory-200/[0.07] bg-ink-1000/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMenu}
          className="-ml-1 flex h-8 w-8 items-center justify-center rounded-[3px] text-graphite-300 transition-colors hover:text-ivory-50 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={17} strokeWidth={1.4} />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
          <span className="hidden text-graphite-600 sm:inline">{T(crumbs.group)}</span>
          <ChevronRight size={11} className="hidden text-graphite-700 sm:inline" strokeWidth={1.4} />
          <span className="truncate text-graphite-200">{T(crumbs.page)}</span>
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenPalette}
            className="group hidden h-8 items-center gap-2.5 rounded-[3px] border border-ivory-200/[0.09] bg-ink-950/60 pl-3 pr-2.5 text-[11.5px] text-graphite-500 transition-all duration-300 hover:border-ivory-200/20 hover:text-graphite-200 md:flex"
          >
            <Search size={13} strokeWidth={1.4} />
            <span>{T("Search the office")}</span>
            <kbd className="ml-2 rounded-[2px] border border-ivory-200/12 px-1 py-px text-[9px] tracking-[0.1em] text-graphite-500">⌘K</kbd>
          </button>
          <button
            type="button"
            onClick={onOpenPalette}
            aria-label="Search"
            className="flex h-8 w-8 items-center justify-center rounded-[3px] text-graphite-300 transition-colors hover:text-ivory-50 md:hidden"
          >
            <Search size={15} strokeWidth={1.4} />
          </button>

          <span className="mx-1 hidden h-4 w-px bg-ivory-200/10 lg:block" />
          <LocalClock timeZone={user.timezone} />

          <NotificationsBell initialUnread={unread} />

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              aria-expanded={menuOpen}
              aria-label="Account"
              className={cn(
                'flex h-8 items-center gap-2.5 rounded-[3px] border border-transparent pl-1 pr-2 transition-all duration-300 hover:border-ivory-200/12',
                menuOpen && 'border-ivory-200/12',
              )}
            >
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-gold-400/35 bg-gold-400/[0.07] text-[10px] tracking-[0.04em] text-gold-200">
                {user.initials}
              </span>
              <span className="hidden text-[11.5px] text-graphite-200 sm:block">{user.fullName.split(' ')[0]}</span>
            </button>

            <AnimatePresence>
              {menuOpen ? (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.985 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute right-0 top-[calc(100%+10px)] z-50 w-[266px] overflow-hidden rounded-[6px] border border-ivory-200/[0.12] bg-ink-950/97 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)] backdrop-blur-xl"
                >
                  <div className="border-b border-ivory-200/[0.08] px-5 py-4">
                    <p className="text-[13px] text-ivory-50">{user.fullName}</p>
                    <p className="mt-1 truncate text-[11.5px] text-graphite-500">{user.email}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[9.5px] uppercase tracking-[0.18em]">
                      <span className="rounded-[2px] border border-gold-400/35 px-1.5 py-0.5 text-gold-200">{planName}</span>
                      <span className="rounded-[2px] border border-ivory-200/12 px-1.5 py-0.5 text-graphite-400">{user.role}</span>
                      <span className="text-graphite-600">briefing {user.briefingTime}</span>
                    </div>
                  </div>
                  <div className="p-1.5">
                    {[
                      { href: '/settings', label: 'Settings', icon: Settings2 },
                      { href: '/membership', label: 'Membership & billing', icon: CreditCard },
                      { href: '/support', label: 'Speak to the office', icon: LifeBuoy },
                    ].map((entry) => (
                      <Link
                        key={entry.href}
                        href={entry.href}
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 rounded-[3px] px-3.5 py-2 text-[12.5px] text-graphite-200 transition-colors hover:bg-ivory-100/[0.05] hover:text-ivory-50"
                      >
                        <entry.icon size={14} strokeWidth={1.4} className="text-graphite-500" />
                        {entry.label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-ivory-200/[0.08] p-1.5">
                    <button
                      type="button"
                      onClick={signOut}
                      disabled={signingOut}
                      className="flex w-full items-center gap-3 rounded-[3px] px-3.5 py-2 text-left text-[12.5px] text-graphite-200 transition-colors hover:bg-state-risk/[0.08] hover:text-state-risk disabled:opacity-60"
                    >
                      <LogOut size={14} strokeWidth={1.4} className="text-graphite-500" />
                      {signingOut ? 'Closing session…' : 'Sign out'}
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

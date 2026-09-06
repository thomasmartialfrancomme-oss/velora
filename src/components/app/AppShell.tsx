'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar, type ShellUser } from '@/components/app/Sidebar';
import { Topbar } from '@/components/app/Topbar';
import { CommandPalette } from '@/components/app/CommandPalette';

export function AppShell({
  user,
  unread,
  planName,
  pending,
  children,
}: {
  user: ShellUser;
  unread: number;
  planName: string;
  /** A count of items awaiting the member's attention, surfaced in the rail. */
  pending: { label: string; count: number };
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const pathname = usePathname();

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Every navigation starts at the top, unless the link carried a #target.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.hash) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);

  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="min-h-svh bg-ink-1000">
      <Sidebar user={user} open={menuOpen} onClose={() => setMenuOpen(false)} pendingItems={pending} planName={planName} />
      <div className="lg:pl-[248px]">
        <Topbar user={user} unread={unread} planName={planName} onOpenMenu={() => setMenuOpen(true)} onOpenPalette={openPalette} />
        <main id="main" className="mx-auto w-full max-w-[1380px] px-4 pb-24 pt-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} role={user.role} />
    </div>
  );
}

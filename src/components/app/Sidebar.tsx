'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { BrandLockup } from '@/components/brand';
import { NAV_GROUPS, isActive } from '@/components/app/nav';
import { cn, pluralise } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

export interface ShellUser {
  fullName: string;
  email: string;
  initials: string;
  role: 'owner' | 'admin' | 'staff';
  timezone: string;
  briefingTime: string;
}

export function Sidebar({
  user,
  open,
  onClose,
  pendingItems,
  planName,
}: {
  user: ShellUser;
  open: boolean;
  onClose: () => void;
  pendingItems: { label: string; count: number };
  planName: string;
}) {
  const pathname = usePathname();
  const T = useT();
  // The navigation is authored once in nav.ts and reused by the drawer, the
  // command palette and the breadcrumb, so the words are translated where they
  // are shown — one dictionary entry covers every place they appear.
  const groups = NAV_GROUPS.filter((group) => group.items.some((item) => !item.admin || user.role === 'admin'));

  const body = (
    <>
      <div className="flex items-center justify-between px-7 pb-7 pt-7">
        <BrandLockup href="/dashboard" size="sm" wordmark={false} />
        <button
          type="button"
          onClick={onClose}
          className="-mr-1 rounded-[3px] p-1.5 text-graphite-400 transition-colors hover:text-ivory-100 lg:hidden"
          aria-label="Close navigation"
        >
          <X size={17} strokeWidth={1.4} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 pb-6">
        {pendingItems.count > 0 ? (
          <Link
            href="/dashboard#tasks"
            onClick={onClose}
            className="mb-6 flex items-center justify-between rounded-[4px] border border-gold-400/25 bg-gold-400/[0.05] px-4 py-3 transition-colors duration-300 hover:border-gold-400/45 hover:bg-gold-400/[0.08]"
          >
            <span className="text-[11.5px] uppercase tracking-[0.18em] text-gold-200">{pendingItems.label}</span>
            <span className="font-serif text-[1.05rem] leading-none text-gold-100">{pendingItems.count}</span>
          </Link>
        ) : null}

        {groups.map((group) => (
          <div key={group.title} className="mb-7 last:mb-0">
            <p className="label mb-3 px-3 text-graphite-600">{T(group.title)}</p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-[3px] px-3 py-2 text-[13px] transition-all duration-300 ease-lux',
                        active ? 'bg-ivory-100/[0.06] text-ivory-50' : 'text-graphite-300 hover:bg-ivory-100/[0.03] hover:text-ivory-100',
                      )}
                    >
                      <span
                        className={cn(
                          'absolute left-0 top-1/2 h-4 w-px -translate-y-1/2 bg-gold-400 transition-all duration-400 ease-lux',
                          active ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <Icon size={15} strokeWidth={1.4} className={cn('shrink-0 transition-colors duration-300', active ? 'text-gold-300' : 'text-graphite-500 group-hover:text-graphite-300')} />
                      <span className="truncate">{T(item.label)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-ivory-200/[0.07] px-7 py-5">
        <p className="text-[11.5px] text-ivory-100">{user.fullName}</p>
        <p className="mt-1 truncate text-[11px] text-graphite-500">{user.email}</p>
        <div className="mt-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-graphite-500">
          <span className="rounded-[2px] border border-ivory-200/10 px-1.5 py-0.5">{planName}</span>
          <span>{pluralise(pendingItems.count, 'open item')}</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-ivory-200/[0.07] bg-ink-1000/95 backdrop-blur-sm lg:flex">
        {body}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              key="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
              className="fixed inset-0 z-40 bg-ink-1000/80 backdrop-blur-[3px] lg:hidden"
            />
            <motion.aside
              key="drawer"
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-ivory-200/[0.09] bg-ink-950 lg:hidden"
            >
              {body}
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

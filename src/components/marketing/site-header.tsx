'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { BrandLockup } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';

const LINKS = [
  { href: '/#office', label: 'The Office' },
  { href: '/#residences', label: 'Residences' },
  { href: '/#intelligence', label: 'AI Concierge' },
  { href: '/membership', label: 'Membership' },
  { href: '/security', label: 'Discretion' },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const T = useT();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-all duration-600 ease-lux',
        scrolled ? 'border-b border-ivory-200/[0.07] bg-ink-1000/85 backdrop-blur-xl' : 'border-b border-transparent',
      )}
    >
      <div className="container flex h-[68px] items-center justify-between gap-6">
        <Link href="/" className="group flex items-center" aria-label="VELORA PRIVATE — home">
          <BrandLockup size="md" className="transition-opacity duration-300 group-hover:opacity-90" />
        </Link>

        <nav className="hidden items-center gap-8 lg:flex" aria-label="Primary">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative text-[11px] uppercase tracking-[0.22em] text-graphite-200 transition-colors duration-300 hover:text-ivory-50"
            >
              {T(link.label)}
              <span className="absolute -bottom-1.5 left-0 h-px w-full origin-left scale-x-0 bg-gold-400/70 transition-transform duration-500 ease-lux group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <LocaleSwitcher compact className="hidden lg:flex" />
          <span aria-hidden className="h-4 w-px bg-ivory-200/10" />
          {signedIn ? (
            <Button href="/dashboard" variant="primary" size="sm" trailingIcon={<ArrowUpRight size={13} strokeWidth={1.4} />}>{T("Open dashboard")}</Button>
          ) : (
            <>
              <Button href="/login" variant="ghost" size="sm" asLink>{T("Sign in")}</Button>
              <Button href="/access/request" variant="gold-outline" size="sm" asLink>{T("Request private access")}</Button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] border border-ivory-200/10 text-ivory-100 transition-colors hover:border-gold-400/40 md:hidden"
        >
          {open ? <X size={17} strokeWidth={1.3} /> : <Menu size={17} strokeWidth={1.3} />}
        </button>
      </div>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-ivory-200/[0.07] bg-ink-1000/97 backdrop-blur-xl md:hidden"
          >
            <nav className="container flex flex-col py-4" aria-label="Mobile">
              {LINKS.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + index * 0.045, duration: 0.35 }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between border-b border-ivory-200/[0.06] py-4 text-[12px] uppercase tracking-[0.2em] text-ivory-100"
                  >
                    {link.label}
                    <ArrowUpRight size={14} className="text-graphite-400" />
                  </Link>
                </motion.div>
              ))}
              <div className="mt-6 flex flex-col gap-3">
                {signedIn ? (
                  <Button href="/dashboard" variant="primary" size="md" asLink>{T("Open dashboard")}</Button>
                ) : (
                  <>
                    <LocaleSwitcher className="pt-2" />
                    <Button href="/login" variant="secondary" size="md" asLink>{T("Sign in")}</Button>
                    <Button href="/access/request" variant="gold-outline" size="md" asLink>{T("Request private access")}</Button>
                  </>
                )}
              </div>
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

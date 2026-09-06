import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { VeloraMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { getT } from '@/lib/i18n/server';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';

const COLUMNS = [
  {
    title: 'Platform',
    links: [
      { href: '/properties', label: 'Properties' },
      { href: '/travel', label: 'Travel' },
      { href: '/lifestyle', label: 'Lifestyle' },
      { href: '/ai', label: 'AI Concierge' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/security', label: 'Security' },
      { href: '/access/request', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy' },
      { href: '/terms', label: 'Terms' },
    ],
  },
];

export function SiteFooter() {
  const T = getT();
  return (
    <footer className="relative border-t border-ivory-200/[0.07] bg-ink-950">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/25 to-transparent" />
      <div className="container py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,0.6fr))_auto]">
          <div className="max-w-sm">
            <span className="inline-flex items-center gap-3">
              <VeloraMark size={26} />
              <span className="font-sans text-[15px] uppercase tracking-[0.4em] text-ivory-50">{T("Velora")}</span>
            </span>
            <p className="mt-5 font-serif text-[1.15rem] leading-relaxed text-graphite-200">{T("Private intelligence for modern estates and lifestyles.")}</p>
            <p className="mt-4 text-[12px] leading-relaxed text-graphite-500">{T("Members only. Available in selected jurisdictions, by introduction or application.")}</p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="label mb-5 text-graphite-400">{T(column.title)}</p>
              <ul className="space-y-3">
                {column.links.map((link) => (
                  <li key={`${column.title}-${link.href}`}>
                    <Link
                      href={link.href}
                      className="group inline-flex items-center gap-1.5 text-[13px] text-graphite-200 transition-colors duration-300 hover:text-ivory-50"
                    >
                      {T(link.label)}
                      <ArrowUpRight size={11} className="opacity-0 transition-all duration-300 group-hover:translate-x-0.5 group-hover:opacity-60" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          <div className="lg:justify-self-end">
            <p className="label mb-5 text-graphite-400">{T("Begin")}</p>
            <Button href="/access/request" variant="gold-outline" size="md" asLink>{T("Request private access")}</Button>
            <p className="mt-4 max-w-[190px] text-[11.5px] leading-relaxed text-graphite-500">{T("Applications are reviewed personally. Expect a reply within two business days.")}</p>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-ivory-200/[0.06] pt-8 text-[11px] text-graphite-500 sm:flex-row sm:items-center sm:justify-between">
          <p className="tracking-[0.14em]">© {new Date().getFullYear()} VELORA PRIVATE · ALL RIGHTS RESERVED</p>
          <p className="tracking-[0.1em]">{T("VELORA organises information and records. It does not provide legal, tax or financial advice.")}</p>
          <LocaleSwitcher compact />
        </div>
      </div>
    </footer>
  );
}

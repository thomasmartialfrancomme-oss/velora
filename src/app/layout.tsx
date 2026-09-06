import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';
import { I18nProvider } from '@/lib/i18n/context';
import { getT, localeMeta, localeTable } from '@/lib/i18n/server';
import './globals.css';

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Manrope({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const isProduction = process.env.NODE_ENV === 'production';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: 'VELORA PRIVATE — AI Private Estate & Lifestyle Manager',
    template: '%s · VELORA PRIVATE',
  },
  description:
    'Your private world, intelligently managed. One command center for residences, staff, travel, lifestyle and private operations — for family offices, multi-property owners and principals.',
  keywords: [
    'private estate management',
    'family office software',
    'AI concierge',
    'household management',
    'ultra high net worth',
  ],
  authors: [{ name: 'VELORA PRIVATE' }],
  creator: 'VELORA PRIVATE',
  openGraph: {
    type: 'website',
    siteName: 'VELORA PRIVATE',
    title: 'VELORA PRIVATE — AI Private Estate & Lifestyle Manager',
    description: 'One intelligent command center for your properties, people, travel, lifestyle and private operations.',
    locale: 'en_GB',
  },
  twitter: { card: 'summary_large_image', title: 'VELORA PRIVATE', description: 'Your private world, intelligently managed.' },
  // A demo build should never be indexed.
  robots: isProduction ? { index: true, follow: true } : { index: false, follow: false },
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: '#07080A',
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The language is resolved once, here, for the whole tree: the document gets the
  // right `lang` (screen readers and translation prompts depend on it), the server
  // chrome reads its table from the same request, and the interactive parts
  // receive it through context — one source of truth per render.
  const { locale, htmlLang, dir } = localeMeta();
  const T = getT(locale);
  return (
    <html lang={htmlLang} dir={dir} className={`${display.variable} ${sans.variable}`}>
      <body className="grain bg-ink-1000 font-sans text-ivory-100 antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-6 focus:top-6 focus:z-[90] focus:rounded-[3px] focus:border focus:border-gold-400/50 focus:bg-ink-900 focus:px-4 focus:py-2 focus:text-[11px] focus:uppercase focus:tracking-[0.2em] focus:text-ivory-50"
        >
          {T('Skip to content')}
        </a>
        <I18nProvider locale={locale} table={localeTable(locale)}>
          <ToastProvider>{children}</ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}

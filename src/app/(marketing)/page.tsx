import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Hero } from '@/components/marketing/hero';
import { PrivateOffice } from '@/components/marketing/private-office';
import { ResidencesShowcase } from '@/components/marketing/residences-showcase';
import { ConciergeDemo } from '@/components/marketing/concierge-demo';
import { OneCommand } from '@/components/marketing/one-command';
import { Discretion } from '@/components/marketing/discretion';
import { MembershipStrip } from '@/components/marketing/membership-strip';
import { ClosingCta } from '@/components/marketing/closing-cta';
import { Section } from '@/components/marketing/section';
import { Reveal } from '@/components/ui/reveal';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'VELORA PRIVATE — Your private world, intelligently managed',
  description:
    'An AI-augmented private estate and lifestyle office: residences, staff, vehicles, travel, ledger and documents, coordinated from one command center.',
};

const METHOD = [
  {
    step: '01',
    title: 'Application',
    body: 'A short conversation about your residences, your households and what currently takes too long. No card details, no automated sales sequence.',
    meta: '2 days',
  },
  {
    step: '02',
    title: 'Loading the household',
    body: 'We import your properties, staff, service contracts, insurance, vehicles and standing preferences into a single, private record set.',
    meta: '1–3 weeks',
  },
  {
    step: '03',
    title: 'Daily rhythm',
    body: 'From the first Monday, a briefing arrives at your hour. Requests are coordinated, chased and closed. You approve what needs a decision.',
    meta: 'continuous',
  },
];

export default function LandingPage() {
  const T = getT();
  return (
    <>
      <Hero />

      <PrivateOffice />

      <Section
        id="method"
        eyebrow="How it begins"
        title={
          <>
            Quietly installed,
            <br />
            then simply run.
          </>
        }
        lede="VELORA is not a tool you have to learn. It is an office that learns yours, and reports in one place."
        tone="default"
      >
        <ol className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] lg:grid-cols-3">
          {METHOD.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.09} className="h-full">
              <li className="group relative flex h-full flex-col justify-between bg-ink-950 p-8 transition-colors duration-500 ease-lux hover:bg-ink-900/70 sm:p-10">
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-[2.6rem] leading-none text-ivory-100/12 transition-colors duration-500 group-hover:text-gold-400/35">{item.step}</span>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-graphite-500">{T(item.meta)}</span>
                </div>
                <div className="mt-10">
                  <h3 className="font-serif text-[1.3rem] uppercase tracking-[0.06em] text-ivory-50">{T(item.title)}</h3>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-graphite-300">{T(item.body)}</p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Suspense fallback={null}>
        <ResidencesShowcase />
      </Suspense>

      <ConciergeDemo />

      <OneCommand />

      <section className="relative border-y border-ivory-200/[0.07] bg-ink-1000 py-20 sm:py-24">
        <div className="container">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="label mb-9 text-graphite-500">{T("In practice")}</p>
            <blockquote className="font-serif text-[clamp(1.5rem,3vw,2.35rem)] font-light leading-[1.35] text-ivory-100">{T("“We stopped keeping a spreadsheet of who is where, and what still needs chasing. The briefing simply knows — and when it does not know, it says so.”")}</blockquote>
            <p className="mt-8 text-[11px] uppercase tracking-[0.26em] text-graphite-500">{T("Chief of staff · family office, six households")}</p>
          </Reveal>
        </div>
      </section>

      <Discretion />

      <MembershipStrip />

      <ClosingCta />
    </>
  );
}

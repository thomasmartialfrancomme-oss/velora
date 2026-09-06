import type { Metadata } from 'next';
import { AccessRequestForm, RequestStatusLookup } from '@/components/marketing/access-request-form';
import { Reveal } from '@/components/ui/reveal';
import { getT } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: 'Request private access',
  description:
    'A short, considered enquiry. Tell us how many residences you keep and what currently takes too long — the private office replies within two working days.',
};

export const dynamic = 'force-dynamic';

const ASKS = [
  ['Where you keep your residences', 'Countries and count — it decides who is on your office and what hour the briefing lands.'],
  ['What is difficult today', 'Usually a number of households, a staff rota, an aviation requirement, or a ledger nobody trusts.'],
  ['Who may speak for you', 'Whether a chief of staff or family office director holds the day-to-day pen.'],
];

const OFFERS = [
  ['A named private office', 'Not a ticket queue. One lead, one deputy, one analyst, reachable on a single number.'],
  ['A loaded record set', 'Residences, contracts, staff, vehicles, insurance and standing preferences, imported and checked.'],
  ['A briefing every morning', 'Arrivals, expiring documents, open items, spend, and anything needing your decision in the next 48 hours.'],
];

export default function AccessRequestPage() {
  const T = getT();
  return (
    <>
      <header className="relative border-b border-ivory-200/[0.07] bg-ink-1000 pb-16 pt-16 sm:pb-20 sm:pt-24">
        <div className="container">
          <div className="grid items-end gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <Reveal>
              <p className="label mb-6 text-gold-300/80">{T("Membership")}</p>
              <h1 className="font-serif text-[clamp(2.5rem,5.6vw,4.4rem)] font-light uppercase leading-[1.04] tracking-[0.03em] text-ivory-50">{T("Request")}<br />
                private access
              </h1>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="max-w-md text-[14.5px] leading-[1.8] text-graphite-300">{T("We take a limited number of households each quarter, so that every office is properly staffed before it opens. This enquiry is read by the private office — not routed through a sales desk — and answered within two working days.")}</p>
            </Reveal>
          </div>
        </div>
      </header>

      <section className="bg-ink-1000 py-16 sm:py-24">
        <div className="container">
          <div className="grid gap-14 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="space-y-14">
              <Reveal>
                <h2 className="label mb-7 text-graphite-400">{T("What we ask")}</h2>
                <ul className="space-y-6">
                  {ASKS.map(([title, body]) => (
                    <li key={title} className="border-l border-ivory-200/[0.1] pl-5">
                      <p className="text-[13.5px] text-ivory-100">{title}</p>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-graphite-400">{body}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={0.08}>
                <h2 className="label mb-7 text-graphite-400">{T("What follows")}</h2>
                <ul className="space-y-6">
                  {OFFERS.map(([title, body]) => (
                    <li key={title} className="border-l border-gold-400/40 pl-5">
                      <p className="text-[13.5px] text-ivory-100">{title}</p>
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-graphite-400">{body}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal delay={0.14}>
                <div className="rounded-[6px] border border-ivory-200/[0.08] bg-ink-950/70 p-7">
                  <p className="label mb-4 text-graphite-400">{T("On discretion")}</p>
                  <p className="text-[12.5px] leading-relaxed text-graphite-300">{T("Nothing you write here is shared with a third party, used to advertise, or kept longer than eighteen months after a request closes. Requests are stored in the same register as member data, under the same access rules.")}</p>
                </div>
              </Reveal>
            </div>

            <div className="space-y-7">
              <AccessRequestForm />
              <RequestStatusLookup />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

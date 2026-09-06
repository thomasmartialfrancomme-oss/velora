import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Section } from '@/components/marketing/section';
import { Reveal } from '@/components/ui/reveal';
import { MEMBERSHIP_PLANS, cn } from '@/lib/utils/format';

export function MembershipStrip() {
  return (
    <Section
      id="membership"
      eyebrow="Membership"
      title={
        <>
          Three levels of
          <br />
          attention.
        </>
      }
      lede="Membership is a service relationship, priced accordingly. Change, pause or cancel at any time from inside the platform."
      aside={
        <Link href="/membership" className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-gold-200 transition-colors hover:text-gold-100">
          See what is included
          <ArrowUpRight size={12} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      }
    >
      <div className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] lg:grid-cols-3">
        {MEMBERSHIP_PLANS.map((plan, index) => (
          <Reveal key={plan.key} delay={index * 0.08} className="h-full">
            <div className={cn('relative flex h-full flex-col bg-ink-950 p-8 sm:p-9', plan.featured && 'bg-ink-900')}>
              {plan.featured ? <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" /> : null}
              <div className="flex items-baseline justify-between gap-4">
                <p className="font-serif text-[1.3rem] uppercase tracking-[0.16em] text-ivory-50">{plan.name}</p>
                {plan.featured ? <span className="text-[9.5px] uppercase tracking-[0.24em] text-gold-300">Most chosen</span> : null}
              </div>
              <p className="mt-4 text-[13px] leading-relaxed text-graphite-300">{plan.positioning}</p>
              <p className="mt-8 font-serif text-[2.4rem] leading-none text-ivory-50">
                {plan.price_label}
                <span className="ml-2 font-sans text-[11px] uppercase tracking-[0.2em] text-graphite-400">/ month</span>
              </p>
              <ul className="mt-8 space-y-3 border-t border-ivory-200/[0.07] pt-6 text-[13px] text-graphite-200">
                {plan.features.slice(0, 5).map((feature) => (
                  <li key={feature} className="flex gap-3">
                    <span className="mt-[7px] h-px w-3 shrink-0 bg-gold-400/50" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-9 flex items-center justify-between border-t border-ivory-200/[0.07] pt-5">
                <span className="text-[10.5px] uppercase tracking-[0.2em] text-graphite-500">{plan.response_sla}</span>
                <Link href={`/membership?plan=${plan.key}`} className="text-[11px] uppercase tracking-[0.2em] text-ivory-100 transition-colors hover:text-gold-200">
                  Details →
                </Link>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

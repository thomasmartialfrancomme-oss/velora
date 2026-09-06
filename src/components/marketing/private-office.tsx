'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Building2, Landmark, Plane, Route, Users, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { APP_MODULES } from '@/lib/utils/format';
import { Section } from '@/components/marketing/section';
import { Reveal } from '@/components/ui/reveal';

const ICONS: Record<string, LucideIcon> = {
  property: Building2,
  people: Users,
  travel: Plane,
  lifestyle: UtensilsCrossed,
  finance: Landmark,
  intelligence: Route,
};

export function PrivateOffice() {
  const reduce = useReducedMotion();
  return (
    <Section
      id="office"
      eyebrow="The private office"
      title={
        <>
          A private office,
          <br />
          powered by intelligence.
        </>
      }
      lede="Six modules, one standard of service. Each one is a working surface — not a brochure page — and all of them answer to the same coordinator."
      tone="raised"
    >
      <div className="grid gap-px overflow-hidden rounded-[6px] border border-ivory-200/[0.07] bg-ivory-200/[0.06] sm:grid-cols-2 lg:grid-cols-3">
        {APP_MODULES.map((module, index) => {
          const Icon = ICONS[module.key] ?? Building2;
          return (
            <Reveal key={module.key} delay={index * 0.06} className="h-full">
              <Link
                href={`${module.route}`}
                className="group relative flex h-full min-h-[268px] flex-col justify-between overflow-hidden bg-ink-950 p-8 transition-colors duration-600 ease-lux hover:bg-ink-900"
                aria-label={`${module.label} module`}
              >
                <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-600 ease-lux group-hover:opacity-100">
                  <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/60 to-transparent" />
                  <span className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_0%,rgba(201,169,106,0.07),transparent)]" />
                </span>

                <div className="relative">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory-200/12 text-graphite-200 transition-all duration-500 ease-lux group-hover:border-gold-400/45 group-hover:text-gold-200">
                    <Icon size={17} strokeWidth={1.2} />
                  </span>
                  <p className="mt-7 text-[10px] uppercase tracking-[0.3em] text-graphite-500">0{index + 1}</p>
                  <h3 className="mt-3 font-serif text-[1.55rem] uppercase leading-none text-ivory-50">{module.label}</h3>
                  <p className="mt-4 max-w-xs text-[13.5px] leading-relaxed text-graphite-300">{module.detail}</p>
                </div>

                <div className="relative mt-8 flex items-end justify-between">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-graphite-500 transition-colors duration-500 group-hover:text-graphite-300">
                    {module.blurb}
                  </p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-ivory-200/10 text-graphite-300 transition-all duration-500 ease-lux group-hover:border-gold-400/50 group-hover:text-gold-200">
                    <motion.span
                      animate={reduce ? {} : { x: [0, 0], y: [0, 0] }}
                      whileHover={{}}
                      className="block"
                    >
                      <ArrowUpRight size={13} strokeWidth={1.5} />
                    </motion.span>
                  </span>
                </div>

                {/* hairline that draws itself on hover */}
                <span className="pointer-events-none absolute bottom-0 left-0 h-px w-full origin-left scale-x-0 bg-gold-400/45 transition-transform duration-[800ms] ease-lux group-hover:scale-x-100" />
              </Link>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
}

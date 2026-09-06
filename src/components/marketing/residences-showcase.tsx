'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Section } from '@/components/marketing/section';
import { RawBadge as Badge, StatusDot } from '@/components/ui/badge';
import { cn, formatMoney } from '@/lib/utils/format';

/**
 * Demonstration dashboard for the marketing page. Illustrative figures only —
 * the signed-in product reads real rows from the database.
 */
interface DemoProperty {
  name: string;
  city: string;
  country: string;
  status: 'Operational' | 'Attention' | 'Standby' | 'Maintenance';
  tone: 'ok' | 'attention' | 'neutral';
  temperature: string;
  humidity: string;
  lastService: string;
  nextService: string;
  staff: number;
  ops: number;
  tasks: { label: string; when: string; state: 'done' | 'open' | 'waiting' }[];
  accent: string;
}

const PROPERTIES: DemoProperty[] = [
  {
    name: 'Villa Azure',
    city: 'Saint-Barthélemy',
    country: 'FWI',
    status: 'Attention',
    tone: 'attention',
    temperature: '27.4°C',
    humidity: '71%',
    lastService: '26 Aug',
    nextService: '14 Sep',
    staff: 4,
    ops: 1842000,
    tasks: [
      { label: 'Pool plant service confirmation', when: 'awaiting supplier', state: 'waiting' },
      { label: 'Pre-storm generator top-up', when: 'today', state: 'open' },
      { label: 'Beach villa turnover', when: 'complete', state: 'done' },
    ],
    accent: 'rgba(201,169,106,0.85)',
  },
  {
    name: 'Hôtel Particulier Vauban',
    city: 'Paris',
    country: 'FR',
    status: 'Operational',
    tone: 'ok',
    temperature: '21.2°C',
    humidity: '44%',
    lastService: '02 Sep',
    nextService: '27 Sep',
    staff: 3,
    ops: 1128000,
    tasks: [
      { label: 'Courtyard re-lighting sign-off', when: 'complete', state: 'done' },
      { label: 'Winter linen stock ordered', when: 'today', state: 'open' },
      { label: 'Chimney sweep — book before Oct', when: 'this month', state: 'open' },
    ],
    accent: 'rgba(238,232,219,0.75)',
  },
  {
    name: 'Emirates Hills Residence',
    city: 'Dubai',
    country: 'AE',
    status: 'Standby',
    tone: 'neutral',
    temperature: '24.0°C',
    humidity: '39%',
    lastService: '22 Jul',
    nextService: '08 Nov',
    staff: 1,
    ops: 742000,
    tasks: [
      { label: 'Pool drained and sealed', when: 'complete', state: 'done' },
      { label: 'Nightly patrol rota', when: 'active', state: 'open' },
      { label: 'Bentley dealer service slot', when: 'needs decision', state: 'waiting' },
    ],
    accent: 'rgba(140,153,172,0.8)',
  },
  {
    name: 'Monte Carlo Penthouse',
    city: 'Monaco',
    country: 'MC',
    status: 'Operational',
    tone: 'ok',
    temperature: '22.8°C',
    humidity: '48%',
    lastService: '19 Aug',
    nextService: '10 Oct',
    staff: 2,
    ops: 962400,
    tasks: [
      { label: 'Arrival protocol for 18 Sep', when: 'in progress', state: 'open' },
      { label: 'Garage bay 7 cleared', when: 'complete', state: 'done' },
      { label: 'Le Louis XV table', when: 'requested', state: 'waiting' },
    ],
    accent: 'rgba(201,169,106,0.95)',
  },
  {
    name: 'Belgravia Townhouse',
    city: 'London',
    country: 'UK',
    status: 'Operational',
    tone: 'ok',
    temperature: '19.6°C',
    humidity: '52%',
    lastService: '29 Aug',
    nextService: '02 Oct',
    staff: 2,
    ops: 688400,
    tasks: [
      { label: 'Cellar audit reconciled', when: 'complete', state: 'done' },
      { label: 'Quarterly staff reviews', when: 'this month', state: 'open' },
      { label: 'Boiler certificate filed', when: 'complete', state: 'done' },
    ],
    accent: 'rgba(140,169,141,0.85)',
  },
];

export function ResidencesShowcase() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (paused || reduce) return;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % PROPERTIES.length), 5200);
    return () => window.clearInterval(timer);
  }, [paused, reduce]);

  const property = PROPERTIES[active]!;

  return (
    <Section
      id="residences"
      eyebrow="Private residences"
      title={
        <>
          Six residences.
          <br />
          One condition report.
        </>
      }
      lede="Every home reports the same way: condition, climate, people present, what is due, and what it cost this month. No spreadsheets, no chasing."
      tone="default"
      aside={
        <a
          href="/login"
          className="group inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-graphite-200 transition-colors hover:text-gold-200"
        >
          Sign in to see live data
          <ArrowUpRight size={12} className="transition-transform duration-300 group-hover:translate-x-0.5" />
        </a>
      }
    >
      <div
        className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,2fr)] lg:gap-14"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="order-2 lg:order-1">
          <p className="label mb-6 text-graphite-400">Private residences</p>
          <ul className="relative space-y-px" role="tablist" aria-label="Residences">
            {PROPERTIES.map((item, index) => {
              const selected = index === active;
              return (
                <li key={item.name}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActive(index)}
                    className={cn(
                      'group relative flex w-full items-center justify-between gap-4 border-b border-ivory-200/[0.07] px-4 py-5 text-left transition-all duration-500 ease-lux',
                      selected ? 'bg-ivory-100/[0.04]' : 'hover:bg-ivory-100/[0.02]',
                    )}
                  >
                    {selected ? <motion.span layoutId="residence-tick" className="absolute left-0 top-0 h-full w-px bg-gold-400" transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} /> : null}
                    <span className="min-w-0">
                      <span className={cn('block font-serif text-[1.15rem] leading-tight transition-colors duration-400', selected ? 'text-ivory-50' : 'text-graphite-200 group-hover:text-ivory-100')}>
                        {item.city}
                      </span>
                      <span className="mt-1 block text-[11.5px] uppercase tracking-[0.18em] text-graphite-500">{item.name}</span>
                    </span>
                    <StatusDot status={item.tone === 'ok' ? 'operational' : item.tone === 'attention' ? 'attention' : 'standby'} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="order-1 lg:order-2">
          <AnimatePresence mode="wait">
            <motion.article
              key={property.name}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(3px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, filter: 'blur(3px)' }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-[6px] border border-ivory-200/[0.09] bg-ink-900/70 p-8 shadow-card sm:p-10"
            >
              <span className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${property.accent}, transparent)` }} />

              <header className="flex flex-wrap items-start justify-between gap-6">
                <div>
                  <p className="label text-graphite-400">{property.country}</p>
                  <h3 className="mt-3 font-serif text-[2rem] leading-none text-ivory-50">{property.name}</h3>
                  <p className="mt-2 text-[13px] text-graphite-300">{property.city}</p>
                </div>
                <Badge tone={property.tone === 'ok' ? 'ok' : property.tone === 'attention' ? 'attention' : 'neutral'} dot>
                  Status: {property.status}
                </Badge>
              </header>

              <div className="mt-10 grid grid-cols-2 gap-x-8 gap-y-7 sm:grid-cols-4">
                {[
                  { label: 'Climate', value: property.temperature, sub: property.humidity },
                  { label: 'Maintenance', value: property.nextService, sub: `last ${property.lastService}` },
                  { label: 'Staff present', value: String(property.staff), sub: 'on site now' },
                  { label: 'Monthly operations', value: formatMoney(property.ops), sub: 'recorded' },
                ].map((item) => (
                  <div key={item.label}>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-graphite-500">{item.label}</p>
                    <p className="mt-2.5 font-serif text-[1.3rem] leading-none text-ivory-50 tabular-nums">{item.value}</p>
                    <p className="mt-1.5 text-[11.5px] text-graphite-400">{item.sub}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 border-t border-ivory-200/[0.07] pt-6">
                <p className="label mb-4 text-graphite-400">Next tasks</p>
                <ul className="space-y-3">
                  {property.tasks.map((task, index) => (
                    <motion.li
                      key={task.label}
                      initial={reduce ? { opacity: 1 } : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 + index * 0.09, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center justify-between gap-4 text-[13.5px]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            task.state === 'done' ? 'bg-state-ok' : task.state === 'waiting' ? 'bg-gold-400' : 'bg-graphite-400',
                          )}
                        />
                        <span className="truncate text-ivory-200">{task.label}</span>
                      </span>
                      <span className="shrink-0 text-[11.5px] uppercase tracking-[0.16em] text-graphite-500">{task.when}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              <footer className="mt-9 flex items-center justify-between border-t border-ivory-200/[0.07] pt-5 text-[11.5px] uppercase tracking-[0.18em] text-graphite-500">
                <span>Illustration · live product reads your records</span>
                <span className="tabular-nums">ref {String(active + 1).padStart(2, '0')} / {String(PROPERTIES.length).padStart(2, '0')}</span>
              </footer>
            </motion.article>
          </AnimatePresence>
        </div>
      </div>
    </Section>
  );
}

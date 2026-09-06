'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Section } from '@/components/marketing/section';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

interface Exchange {
  command: string;
  headline: string;
  rows: { label: string; value: string; tone?: 'ok' | 'wait' | 'default' }[];
  footnote: string;
}

const EXCHANGES: Exchange[] = [
  {
    command: 'Prepare everything for my arrival in Monaco.',
    headline: 'Arrival plan prepared.',
    rows: [
      { label: 'Residence', value: 'Monte Carlo Penthouse', tone: 'ok' },
      { label: 'Arrival', value: '18 September — 19:40' },
      { label: 'Driver', value: 'Confirmed · Maybach S 680', tone: 'ok' },
      { label: 'Housekeeping', value: 'Scheduled 16:00', tone: 'ok' },
      { label: 'Dinner', value: 'Reservation requested', tone: 'wait' },
      { label: 'Vehicle', value: 'Ready · garage bay 7', tone: 'ok' },
    ],
    footnote: 'Two steps remain with people, not with software. Nothing is marked done until a person answers.',
  },
  {
    command: 'Prepare my Paris weekend.',
    headline: 'Vauban prepared for Friday.',
    rows: [
      { label: 'Residence', value: 'Hôtel Particulier Vauban', tone: 'ok' },
      { label: 'Arrival', value: 'Friday — 12:00', tone: 'ok' },
      { label: 'Chef', value: 'Menu submitted for approval', tone: 'wait' },
      { label: 'Fittings', value: 'Loro Piana 11:00 — to confirm', tone: 'wait' },
      { label: 'House', value: 'Two suites turned down', tone: 'ok' },
    ],
    footnote: 'Drafted from your records: 4 people, 2 suppliers, 1 open approval.',
  },
  {
    command: 'Find a private driver for Monday.',
    headline: 'Driver request recorded for Monday.',
    rows: [
      { label: 'Household driver', value: 'L. Doyle — available', tone: 'ok' },
      { label: 'Outside company', value: 'Needs your approval', tone: 'wait' },
      { label: 'Vehicle', value: 'Maybach · courtyard', tone: 'ok' },
      { label: 'Time', value: 'Monday 09:00 (proposed)', tone: 'default' },
    ],
    footnote: 'Action requires confirmation before anyone outside the household is contacted.',
  },
  {
    command: 'Remind the villa manager about the pool maintenance.',
    headline: 'Reminder drafted and tracked.',
    rows: [
      { label: 'Recipient', value: 'K. Mensah · Maintenance', tone: 'ok' },
      { label: 'Their next task', value: 'Awaiting supplier confirmation', tone: 'wait' },
      { label: 'Message', value: 'Pool plant service — 14 September', tone: 'default' },
      { label: 'Delivery', value: 'Not sent · awaiting integration', tone: 'wait' },
    ],
    footnote: 'The office records the instruction and shows plainly that delivery has not happened yet.',
  },
  {
    command: 'Show me this month’s property expenses.',
    headline: 'Recorded this month: €18,420 across 6 entries.',
    rows: [
      { label: 'Villa Azure', value: '€4,120 · grounds & pool plant', tone: 'default' },
      { label: 'Chalet Le Cervin', value: '€5,120 · cladding stage 1', tone: 'default' },
      { label: 'Monte Carlo', value: '€2,890 · concierge levies', tone: 'default' },
      { label: 'Reconciliation', value: '1 entry flagged for review', tone: 'wait' },
    ],
    footnote: 'Bookkeeping organised, not interpreted. Advice comes from your own advisers.',
  },
];

function TypingLine({ text, play, onDone }: { text: string; play: boolean; onDone: () => void }) {
  const T = useT();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? text : '');

  useEffect(() => {
    if (reduce) {
      setShown(text);
      onDone();
      return;
    }
    if (!play) {
      setShown('');
      return;
    }
    let index = 0;
    setShown('');
    const interval = window.setInterval(() => {
      index += 2;
      setShown(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(interval);
        window.setTimeout(onDone, 420);
      }
    }, 26);
    return () => window.clearInterval(interval);
  }, [text, play, reduce, onDone]);

  return (
    <span className="text-ivory-100">
      {shown}
      {shown.length < text.length ? <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-caret-blink bg-gold-300 align-middle" /> : null}
    </span>
  );
}

export function ConciergeDemo() {
  const T = useT();
  const [active, setActive] = useState(0);
  const [typed, setTyped] = useState(false);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px -15% 0px' });
  const reduce = useReducedMotion();

  useEffect(() => {
    if (inView) setStarted(true);
  }, [inView]);

  const exchange = EXCHANGES[active]!;
  const visibleRows = useMemo(() => (typed ? exchange.rows.length : 0), [typed, exchange.rows.length]);

  useEffect(() => {
    if (!typed) return;
    if (reduce) return;
    // auto-advance so the section demonstrates range without user effort
    const timer = window.setTimeout(() => {
      setActive((current) => {
        setTyped(false);
        return (current + 1) % EXCHANGES.length;
      });
    }, 7600);
    return () => window.clearTimeout(timer);
  }, [typed, reduce, active]);

  return (
    <Section
      id="intelligence"
      eyebrow="Velora AI"
      title={
        <>
          Speak normally.
          <br />
          Receive a plan.
        </>
      }
      lede="VELORA AI is not a chatbot bolted onto a database. It reads your own records, proposes the coordinated steps, and records each one against the module that owns it."
      tone="paper"
    >
      <div ref={ref} className="grid gap-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,2fr)] lg:gap-12">
        <div>
          <p className="label mb-5 text-ink-900/45">{T("Try a command")}</p>
          <ul className="space-y-2">
            {EXCHANGES.map((item, index) => (
              <li key={item.command}>
                <button
                  type="button"
                  onClick={() => {
                    setActive(index);
                    setTyped(false);
                  }}
                  className={cn(
                    'group flex w-full items-start gap-3 rounded-[4px] border px-4 py-3.5 text-left transition-all duration-400 ease-lux',
                    index === active
                      ? 'border-ink-900/25 bg-ink-950/[0.04] text-ink-950'
                      : 'border-transparent text-ink-900/70 hover:border-ink-900/15 hover:bg-ink-950/[0.02]',
                  )}
                >
                  <span className="mt-[3px] font-serif text-[11px] text-ink-900/35 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                  <span className="text-[13.5px] leading-snug">{item.command}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-6 max-w-xs text-[12px] leading-relaxed text-ink-900/50">{T("A demonstration of the interface. In the product, the same request writes real tasks against your residences.")}</p>
        </div>

        <div className="relative overflow-hidden rounded-[6px] border border-ink-900/12 bg-ivory-50 shadow-[0_30px_80px_-60px_rgba(13,15,19,0.55)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-ink-900/20 to-transparent" />
          <header className="flex items-center justify-between border-b border-ink-900/10 px-6 py-4">
            <span className="flex items-center gap-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inset-0 rounded-full bg-ink-950/70" />
                <span className="absolute inset-0 animate-pulse-soft rounded-full bg-ink-950/40" />
              </span>
              <span className="text-[10.5px] uppercase tracking-[0.3em] text-ink-900/70">{T("Velora AI")}</span>
            </span>
            <span className="text-[10.5px] uppercase tracking-[0.2em] text-ink-900/40">{T("Private session · encrypted at rest")}</span>
          </header>

          <div className="px-6 py-7 sm:px-8">
            <div className="flex items-baseline gap-4">
              <span className="label shrink-0 text-ink-900/40">{T("You")}</span>
              <p className="font-serif text-[1.28rem] leading-snug text-ink-950">
                {started ? <TypingLine text={exchange.command} play={!typed} onDone={() => setTyped(true)} /> : <span className="text-ink-900/30">…</span>}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {typed ? (
                <motion.div
                  key={`${active}-answer`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-8 border-t border-ink-900/10 pt-7"
                >
                  <div className="flex items-baseline gap-4">
                    <span className="label shrink-0 text-ink-900/40">{T("Velora")}</span>
                    <p className="font-serif text-[1.2rem] leading-snug text-ink-950">{exchange.headline}</p>
                  </div>

                  <dl className="mt-6 divide-y divide-ink-900/[0.08] border-y border-ink-900/[0.08]">
                    {exchange.rows.map((row, index) => (
                      <motion.div
                        key={row.label}
                        initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: index < visibleRows ? 1 : 0, y: index < visibleRows ? 0 : 8 }}
                        transition={{ delay: 0.12 + index * 0.16, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="flex items-center justify-between gap-6 py-3"
                      >
                        <dt className="text-[11px] uppercase tracking-[0.2em] text-ink-900/45">{row.label}</dt>
                        <dd className="flex items-center gap-2.5 text-right text-[14px] text-ink-950">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 rounded-full',
                              row.tone === 'ok' ? 'bg-[#4f7a55]' : row.tone === 'wait' ? 'bg-[#b08d4f]' : 'bg-ink-900/25',
                            )}
                          />
                          {row.value}
                        </dd>
                      </motion.div>
                    ))}
                  </dl>

                  <p className="mt-5 max-w-lg text-[12.5px] leading-relaxed text-ink-900/55">{exchange.footnote}</p>
                </motion.div>
              ) : (
                <motion.div key="thinking" exit={{ opacity: 0 }} className="mt-8 flex items-center gap-3 text-ink-900/40">
                  <span className="flex gap-1">
                    {[0, 1, 2].map((dot) => (
                      <motion.span
                        key={dot}
                        animate={reduce ? {} : { opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.18, ease: 'easeInOut' }}
                        className="h-1 w-1 rounded-full bg-ink-900/60"
                      />
                    ))}
                  </span>
                  <span className="text-[11.5px] uppercase tracking-[0.2em]">{T("Reading your records")}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Section>
  );
}

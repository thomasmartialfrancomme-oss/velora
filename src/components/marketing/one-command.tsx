'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Section } from '@/components/marketing/section';
import { cn } from '@/lib/utils/format';

const COMMAND = 'Prepare my arrival at the villa.';

const STEPS = [
  { label: 'Housekeeping', module: 'Property', note: 'two housekeepers, 16:00–19:00' },
  { label: 'Chauffeur', module: 'Travel', note: 'handover agreed with the driver' },
  { label: 'Groceries', module: 'Lifestyle', note: 'standing list — needs your approval' },
  { label: 'Security', module: 'People', note: 'patrol overlap suggested' },
  { label: 'Vehicle', module: 'Vehicles', note: 'garage bay cleared and fuelled' },
  { label: 'Dinner reservation', module: 'Lifestyle', note: 'requested, not yet confirmed' },
  { label: 'Staff notification', module: 'People', note: 'four household members briefed' },
];

export function OneCommand() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: false, margin: '-20% 0px -20% 0px' });
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState('');
  const [stage, setStage] = useState<'idle' | 'reading' | 'working' | 'done'>('idle');

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setTyped(COMMAND);
      setStage('done');
      return;
    }
    setStage('idle');
    setTyped('');
    let index = 0;
    const typing = window.setInterval(() => {
      index += 1;
      setTyped(COMMAND.slice(0, index));
      if (index >= COMMAND.length) {
        window.clearInterval(typing);
        window.setTimeout(() => setStage('reading'), 420);
        window.setTimeout(() => setStage('working'), 1500);
        window.setTimeout(() => setStage('done'), 1500 + STEPS.length * 420 + 600);
      }
    }, 42);
    return () => window.clearInterval(typing);
  }, [inView, reduce]);

  const activeCount = stage === 'done' ? STEPS.length : stage === 'working' ? STEPS.length : 0;

  return (
    <Section
      id="command"
      eyebrow="One command"
      title={
        <>
          One command.
          <br />
          Everything coordinated.
        </>
      }
      lede="A single sentence is decomposed into the seven things a private office would actually do, each routed to the module that owns it — and each with an honest status."
    >
      <div ref={ref} className="grid items-stretch gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-[6px] border border-ivory-200/[0.09] bg-ink-900/60 p-8 sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_70%_at_20%_0%,rgba(201,169,106,0.06),transparent)]" />
          <div className="relative">
            <p className="label mb-7 text-graphite-400">Command</p>
            <p className="font-serif text-[1.6rem] leading-snug text-ivory-50 sm:text-[1.9rem]">
              “{typed}
              {stage !== 'done' ? <span className="ml-1 inline-block h-[0.9em] w-[2px] translate-y-[2px] animate-caret-blink bg-gold-300 align-middle" /> : null}”
            </p>
          </div>

          <div className="relative mt-12 space-y-5">
            <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.2em]">
              <span className={cn('h-1.5 w-1.5 rounded-full transition-colors duration-500', stage === 'idle' ? 'bg-graphite-500' : stage === 'reading' ? 'bg-gold-400' : 'bg-state-ok')} />
              <span className={cn('transition-colors duration-500', stage === 'done' ? 'text-state-ok' : 'text-graphite-300')}>
                {stage === 'idle' ? 'Listening' : stage === 'reading' ? 'Reading your records' : stage === 'working' ? 'Coordinating 7 steps' : 'Plan written to your modules'}
              </span>
            </div>
            <div className="h-px w-full bg-ivory-200/[0.08]">
              <motion.div
                className="h-full bg-gold-400/70"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: stage === 'done' ? 1 : stage === 'reading' ? 0.3 : 0 }}
                transition={{ duration: stage === 'done' ? 0.9 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: 'left' }}
              />
            </div>
            <p className="text-[12.5px] leading-relaxed text-graphite-400">
              Two of the seven require a human decision. VELORA records them as requests and will not represent them as complete.
            </p>
          </div>
        </div>

        <ol className="relative space-y-px pl-8">
          <span className="absolute left-[7px] top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-gold-400/50 via-ivory-200/12 to-transparent" aria-hidden />
          <motion.span
            aria-hidden
            className="absolute left-[3.5px] top-2 h-2 w-2 rounded-full bg-gold-300 shadow-[0_0_12px_rgba(201,169,106,0.5)]"
            initial={{ y: 0, opacity: 0 }}
            animate={
              reduce || stage !== 'working'
                ? { y: 0, opacity: 0 }
                : { y: [0, 44, 88, 132, 176, 220, 264], opacity: [0, 1, 1, 1, 1, 1, 0] }
            }
            transition={{ duration: STEPS.length * 0.42, ease: 'easeInOut' }}
          />
          {STEPS.map((step, index) => {
            const reached = index < activeCount;
            return (
              <li key={step.label} className="relative">
                <span
                  className={cn(
                    'absolute -left-8 top-[22px] h-px origin-left bg-ivory-200/15 transition-transform duration-500 ease-lux',
                    'w-8',
                    reached ? 'scale-x-100' : 'scale-x-0',
                  )}
                  aria-hidden
                />
                <motion.div
                  initial={reduce ? { opacity: 1 } : { opacity: 0, x: 14 }}
                  animate={{ opacity: reached || reduce ? 1 : 0.35, x: 0 }}
                  transition={{ delay: reduce ? 0 : 0.1 * index, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    'group flex items-start justify-between gap-5 rounded-[4px] border border-transparent px-5 py-4 transition-all duration-500 ease-lux',
                    reached ? 'border-ivory-200/[0.08] bg-ink-900/45' : 'bg-transparent',
                    'hover:border-ivory-200/[0.16] hover:bg-ink-900/70',
                  )}
                >
                  <span className="flex items-start gap-4">
                    <span
                      className={cn(
                        'mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-all duration-500',
                        reached ? 'border-state-ok/60 bg-state-ok/12 text-state-ok' : 'border-ivory-200/15 text-transparent',
                      )}
                    >
                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M2 6.4l2.6 2.6L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span>
                      <span className={cn('block text-[14.5px] transition-colors duration-500', reached ? 'text-ivory-50' : 'text-graphite-300')}>{step.label}</span>
                      <span className="mt-1 block text-[12px] text-graphite-500">{step.note}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-graphite-500">{step.module}</span>
                </motion.div>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowUpRight } from 'lucide-react';
import { PrivateField } from '@/components/marketing/private-field';
import { Button } from '@/components/ui/button';
import { Counter } from '@/components/ui/counter';
import { cn } from '@/lib/utils/format';

const LINE_ONE = ['Your', 'private', 'world.'];
const LINE_TWO = ['Intelligently', 'managed.'];

function HeadlineLine({ words, delay, className }: { words: string[]; delay: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn('block overflow-hidden', className)}>
      <span className="flex flex-wrap gap-x-[0.28em]">
        {words.map((word, index) => (
          <motion.span
            key={word}
            initial={reduce ? { opacity: 1 } : { y: '108%', opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { y: '0%', opacity: 1 }}
            transition={{ duration: 1.05, delay: delay + index * 0.075, ease: [0.16, 1, 0.3, 1] }}
            className="inline-block gpu"
          >
            {word}
          </motion.span>
        ))}
      </span>
    </span>
  );
}

const FACTS = [
  { value: 6, suffix: '', label: 'Residences coordinated', note: 'in one ledger' },
  { value: 41, suffix: '', label: 'People in the directory', note: 'roles, rosters, receipts' },
  { value: 12, suffix: '', label: 'Jurisdictions', note: 'one standard of service' },
  { value: 24, suffix: '/7', label: 'Private office', note: 'always awake, rarely loud' },
];

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const fieldY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '12%']);
  const headlineY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '7%']);
  const headlineOpacity = useTransform(scrollYProgress, [0, 0.75], [1, reduce ? 1 : 0.15]);

  useEffect(() => {
    document.documentElement.style.setProperty('--hero-ready', '1');
  }, []);

  return (
    <section ref={ref} className="relative isolate min-h-[100svh] overflow-hidden bg-ink-1000 pt-[68px]">
      <motion.div style={{ y: fieldY }} className="absolute inset-0 -z-10">
        <PrivateField />
      </motion.div>

      <div className="container relative flex min-h-[calc(100svh-68px)] flex-col justify-center py-16 sm:py-20">
        <motion.div style={{ y: headlineY, opacity: headlineOpacity }} className="max-w-5xl gpu">
          <motion.p
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="label mb-8 flex items-center gap-4 text-gold-300/85"
          >
            <span className="h-px w-10 bg-gold-400/50" />
            By introduction · Private estate & lifestyle office
          </motion.p>

          <h1 className="display text-display-xl uppercase text-shadow-lux">
            <HeadlineLine words={LINE_ONE} delay={0.2} />
            <HeadlineLine words={LINE_TWO} delay={0.42} className="mt-1 text-ivory-200/90" />
          </h1>

          <motion.p
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.72, ease: [0.16, 1, 0.3, 1] }}
            className="mt-9 max-w-xl text-[16.5px] leading-[1.75] text-graphite-200"
          >
            One intelligent command center for your properties, people, travel, lifestyle and private operations.
          </motion.p>

          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.86, ease: [0.16, 1, 0.3, 1] }}
            className="mt-11 flex flex-wrap items-center gap-4"
          >
            <Button href="/access/request" size="lg" asLink trailingIcon={<ArrowUpRight size={14} strokeWidth={1.4} />}>
              Request private access
            </Button>
            <a href="/#office" className="contents">
              <Button variant="secondary" size="lg" type="button" onClick={() => document.getElementById('office')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })}>
                Explore the platform
              </Button>
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-16 grid grid-cols-2 gap-x-8 gap-y-7 border-t border-ivory-200/[0.07] pt-8 sm:grid-cols-4 sm:gap-x-10"
        >
          {FACTS.map((fact, index) => (
            <div key={fact.label} className="group">
              <p className="font-serif text-[1.9rem] leading-none text-ivory-50 transition-colors duration-500 group-hover:text-gold-200">
                <Counter value={fact.value} suffix={fact.suffix} duration={1300 + index * 160} />
              </p>
              <p className="mt-2.5 text-[11px] uppercase tracking-[0.2em] text-graphite-300">{fact.label}</p>
              <p className="mt-1 text-[12px] text-graphite-500">{fact.note}</p>
            </div>
          ))}
        </motion.div>
      </div>

      <motion.a
        href="#office"
        aria-label="Scroll to the private office"
        initial={reduce ? { opacity: 1 } : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 0.8 }}
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-graphite-400 transition-colors hover:text-ivory-100 lg:flex"
      >
        <span className="text-[10px] uppercase tracking-[0.32em]">Scroll</span>
        <span className="relative flex h-10 w-px justify-center overflow-hidden bg-ivory-200/12">
          <span className="absolute top-0 h-3 w-px animate-scroll-cue bg-gold-300" />
        </span>
        <ArrowDown size={11} className="opacity-50" />
      </motion.a>
    </section>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { cn } from '@/lib/utils/format';

/**
 * Scroll reveal. One IntersectionObserver per node, no layout thrash, and it
 * degrades to "already visible" when the OS asks for reduced motion or when JS
 * never hydrates (the class-based fallback in globals.css).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 22,
  once = true,
  as = 'div',
  blur = false,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
  as?: 'div' | 'section' | 'li' | 'span' | 'article' | 'header';
  blur?: boolean;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as as 'div'] as typeof motion.div;
  return (
    <MotionTag
      className={cn('gpu', className)}
      initial={reduce ? { opacity: 1 } : { opacity: 0, y, filter: blur ? 'blur(6px)' : 'blur(0px)' }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once, margin: '-12% 0px -8% 0px' }}
      transition={{ duration: reduce ? 0 : 0.85, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionTag>
  );
}

/** Stagger container: children use <RevealItem/> for a measured cascade. */
export function RevealGroup({
  children,
  className,
  stagger = 90,
  start = true,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
  start?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px -10% 0px' });
  const active = inView && start;
  return (
    <div ref={ref} className={className}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <motion.div
              key={typeof child === 'object' && child && 'key' in child ? String(child.key) : index}
              initial={{ opacity: 0, y: 18 }}
              animate={active ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.75, delay: active ? index * (stagger / 1000) : 0, ease: [0.16, 1, 0.3, 1] }}
              className="gpu"
            >
              {child}
            </motion.div>
          ))
        : children}
    </div>
  );
}

/** Marks the section currently in view — used for nav underlines and progress. */
export function useActiveSection(ids: string[]) {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActive(visible.target.id);
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: [0.15, 0.4, 0.75] },
    );
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [ids.join('|')]);
  return active;
}

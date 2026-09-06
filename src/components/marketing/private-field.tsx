'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/format';

/**
 * "A private world, quietly turning."
 *
 * Canvas field behind the hero: a hairline grid, slow particulate drift, four
 * floating record-cards (property / calendar / itinerary / ledger) linked by
 * bezier threads that draw and release, and a single gold light source. Every
 * motion is time-based (never frame-counted), capped at 2× DPR, paused when the
 * tab is hidden or the section scrolls away, and reduced to one still frame on
 * request. Total cost: one rAF loop, no layout thrash.
 */

interface CardSpec {
  /** normalised centre */
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  rows: { label: string; value: string }[];
  drift: number;
  phase: number;
  depth: number;
}

const CARDS: CardSpec[] = [
  {
    x: 0.16,
    y: 0.3,
    w: 0.2,
    h: 0.2,
    title: 'VILLA AZURE',
    rows: [
      { label: 'status', value: 'operational' },
      { label: 'staff', value: '4' },
      { label: 'service', value: '14 sep' },
    ],
    drift: 0.011,
    phase: 0.4,
    depth: 0.55,
  },
  {
    x: 0.8,
    y: 0.24,
    w: 0.17,
    h: 0.15,
    title: 'MONDAY',
    rows: [
      { label: 'arrival', value: '19:40' },
      { label: 'transfer', value: 'confirmed' },
    ],
    drift: 0.008,
    phase: 2.1,
    depth: 0.8,
  },
  {
    x: 0.74,
    y: 0.74,
    w: 0.19,
    h: 0.16,
    title: 'ROUTE',
    rows: [
      { label: 'lbgs', value: '→' },
      { label: 'lfmc', value: '1h05' },
    ],
    drift: 0.013,
    phase: 4.0,
    depth: 0.65,
  },
  {
    x: 0.2,
    y: 0.76,
    w: 0.16,
    h: 0.14,
    title: 'LEDGER',
    rows: [
      { label: 'this month', value: '50,060' },
      { label: 'open', value: '2' },
    ],
    drift: 0.009,
    phase: 5.4,
    depth: 0.9,
  },
];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
}

export function PrivateField({ className, intensity = 1 }: { className?: string; intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return;

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles: Particle[] = [];
    let running = true;
    let frame = 0;
    const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    let scrollY = 0;

    const seed = () => {
      const count = Math.round(Math.min(64, Math.max(26, (width * height) / 26000)) * intensity);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.055,
        vy: (Math.random() - 0.5) * 0.045,
        r: Math.random() < 0.12 ? 1.5 : 0.75,
        a: 0.06 + Math.random() * 0.3,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(320, rect.width);
      height = Math.max(360, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = event.clientX / window.innerWidth;
      pointer.ty = event.clientY / window.innerHeight;
    };
    const onScroll = () => {
      scrollY = window.scrollY || 0;
    };
    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduce) frame = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        if (visible && !running && !reduce) {
          running = true;
          frame = requestAnimationFrame(draw);
        } else if (!visible) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { threshold: 0.02 },
    );
    observer.observe(canvas);

    const start = performance.now();

    function drawCard(card: CardSpec, time: number) {
      if (!context) return;
      const parallaxX = (pointer.x - 0.5) * 26 * card.depth;
      const parallaxY = (pointer.y - 0.5) * 16 * card.depth - scrollY * 0.05 * card.depth;
      const drift = Math.sin(time / (9000 + card.phase * 900) + card.phase) * 10;

      const w = card.w * width;
      const h = card.h * height;
      const x = card.x * width - w / 2 + parallaxX;
      const y = card.y * height - h / 2 + parallaxY + drift;

      const alpha = 0.1 + 0.05 * Math.sin(time / 5200 + card.phase);

      // card body
      context.beginPath();
      context.roundRect?.(x, y, w, h, 3);
      if (!context.roundRect) context.rect(x, y, w, h);
      context.fillStyle = `rgba(13, 15, 19, ${0.5 + 0.12 * Math.sin(time / 7000)})`;
      context.fill();
      context.strokeStyle = `rgba(238, 232, 219, ${alpha})`;
      context.lineWidth = 1;
      context.stroke();

      // gold corner tick
      context.beginPath();
      context.moveTo(x, y + 9);
      context.lineTo(x, y);
      context.lineTo(x + 9, y);
      context.strokeStyle = `rgba(201, 169, 106, ${0.35 + 0.2 * Math.sin(time / 4000 + card.phase)})`;
      context.lineWidth = 1;
      context.stroke();

      // header rule + title
      context.beginPath();
      context.moveTo(x + 12, y + 24);
      context.lineTo(x + w - 12, y + 24);
      context.strokeStyle = 'rgba(238, 232, 219, 0.08)';
      context.stroke();

      context.font = '500 8.5px ui-sans-serif, system-ui, sans-serif';
      context.fillStyle = 'rgba(238, 232, 219, 0.42)';
      context.fillText(card.title, x + 12, y + 16);

      // rows
      card.rows.forEach((row, index) => {
        const rowY = y + 40 + index * 15;
        context.font = '400 8px ui-sans-serif, system-ui, sans-serif';
        context.fillStyle = 'rgba(138, 144, 154, 0.55)';
        context.fillText(row.label, x + 12, rowY);
        context.fillStyle = 'rgba(238, 232, 219, 0.5)';
        const valueWidth = context.measureText(row.value).width;
        context.fillText(row.value, x + w - 12 - valueWidth, rowY);
      });

      return { x, y, w, h };
    }

    function drawThread(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, time: number, index: number) {
      if (!context) return;
      const from = { x: a.x + a.w, y: a.y + a.h / 2 };
      const to = { x: b.x, y: b.y + b.h / 2 };
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const progress = (Math.sin(time / 7000 + index * 1.7) + 1) / 2;
      const dash = length * (0.18 + 0.5 * progress);
      const offset = -length * (1 - progress) * 0.6;

      context.beginPath();
      context.setLineDash([dash, length]);
      context.lineDashOffset = offset;
      context.moveTo(from.x, from.y);
      context.bezierCurveTo(from.x + (to.x - from.x) * 0.5, from.y, from.x + (to.x - from.x) * 0.5, to.y, to.x, to.y);
      context.strokeStyle = `rgba(201, 169, 106, ${0.1 + 0.14 * progress})`;
      context.lineWidth = 0.9;
      context.stroke();
      context.setLineDash([]);
    }

    function draw(now = 0) {
      if (!context || !running) return;
      const time = now - start;
      context.clearRect(0, 0, width, height);

      // background vignette
      const glow = context.createRadialGradient(width * 0.5, height * 0.12, 0, width * 0.5, height * 0.12, Math.max(width, height) * 0.7);
      glow.addColorStop(0, 'rgba(201, 169, 106, 0.055)');
      glow.addColorStop(1, 'rgba(7, 8, 10, 0)');
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      // grid
      const gridGap = Math.max(56, Math.min(96, width / 14));
      const parallax = (pointer.x - 0.5) * 12;
      context.beginPath();
      for (let x = -gridGap; x < width + gridGap; x += gridGap) {
        const gx = x + parallax;
        context.moveTo(gx, 0);
        context.lineTo(gx, height);
      }
      for (let y = 0; y < height + gridGap; y += gridGap) {
        const gy = y - scrollY * 0.03;
        context.moveTo(0, gy);
        context.lineTo(width, gy);
      }
      context.strokeStyle = 'rgba(238, 232, 219, 0.028)';
      context.lineWidth = 1;
      context.stroke();

      // particles
      for (const particle of particles) {
        if (!reduce) {
          particle.x += particle.vx + Math.sin(time / 9000 + particle.y) * 0.02;
          particle.y += particle.vy;
          if (particle.x < -10) particle.x = width + 10;
          if (particle.x > width + 10) particle.x = -10;
          if (particle.y < -10) particle.y = height + 10;
          if (particle.y > height + 10) particle.y = -10;
        }
        const fade = 0.4 + 0.6 * Math.sin(time / 3600 + particle.x);
        context.beginPath();
        context.arc(particle.x + parallax * 0.35, particle.y, particle.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(238, 232, 219, ${Math.max(0.02, particle.a * fade)})`;
        context.fill();
      }

      // cards + threads
      const rects = CARDS.map((card) => drawCard(card, time)) as { x: number; y: number; w: number; h: number }[];
      drawThread(rects[0]!, rects[1]!, time, 0);
      drawThread(rects[1]!, rects[2]!, time, 1.4);
      drawThread(rects[2]!, rects[3]!, time, 2.8);
      drawThread(rects[3]!, rects[0]!, time, 4.2);

      pointer.x += (pointer.tx - pointer.x) * 0.035;
      pointer.y += (pointer.ty - pointer.y) * 0.035;

      if (!reduce) frame = requestAnimationFrame(draw);
    }

    draw(performance.now());

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      observer.disconnect();
    };
  }, [intensity]);

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_50%_40%,rgba(7,8,10,0)_0%,rgba(7,8,10,0.55)_75%,#07080A_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink-1000" />
    </div>
  );
}

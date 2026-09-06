'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/format';
import { Button } from '@/components/ui/button';

/**
 * Overlay used by every create/edit/confirm flow. Locks scroll, traps focus
 * roughly (first field on open, Tab cycle inside), closes on Escape, and
 * animates with the same curve as the rest of the product.
 */
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'md',
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  loading?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !loading) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const timer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>('input,textarea,select,button');
      target?.focus();
    }, 120);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous ? overflow : '';
      window.clearTimeout(timer);
      previous?.focus?.();
    };
  }, [open, onClose, loading]);

  if (!mounted) return null;

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size];

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto p-4 py-[6vh] sm:p-8 sm:py-[8vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.35 }}
            onClick={() => !loading && onClose()}
            className="fixed inset-0 bg-ink-1000/80 backdrop-blur-[3px]"
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 26, scale: 0.985 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.99 }}
            transition={{ duration: reduce ? 0.01 : 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn('relative w-full rounded-[6px] border border-ivory-200/12 bg-ink-900/97 shadow-lift', width)}
          >
            <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/35 to-transparent" />
            <header className="flex items-start justify-between gap-6 border-b border-ivory-200/[0.07] px-6 py-5 sm:px-8">
              <div>
                {eyebrow ? <p className="label mb-2">{eyebrow}</p> : null}
                <h2 className="font-serif text-[1.4rem] leading-tight text-ivory-50">{title}</h2>
                {description ? <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-graphite-300">{description}</p> : null}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                aria-label="Close"
                className="-mr-1 -mt-1 rounded-[3px] p-1.5 text-graphite-300 transition-colors hover:bg-ivory-100/[0.05] hover:text-ivory-50 disabled:opacity-40"
              >
                <X size={16} strokeWidth={1.4} />
              </button>
            </header>
            <div className="max-h-[62vh] overflow-y-auto px-6 py-6 sm:px-8">{children}</div>
            {footer ? (
              <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-ivory-200/[0.07] px-6 py-4 sm:px-8">{footer}</footer>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Not yet',
  tone = 'danger',
  busy,
  onConfirm,
  onCancel,
  word,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** when set, the user must type this exact word to enable confirmation */
  word?: string;
}) {
  const [typed, setTyped] = useState('');
  const ready = !word || typed.trim().toUpperCase() === word.toUpperCase();
  return (
    <Modal
      open={open}
      onClose={() => !busy && onCancel()}
      title={title}
      size="sm"
      loading={busy}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} disabled={!ready} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-[13.5px] leading-relaxed text-graphite-200">
        <div>{body}</div>
        {word ? (
          <div>
            <label className="label mb-2 block" htmlFor="confirm-word">
              Type {word} to confirm
            </label>
            <input
              id="confirm-word"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              className="w-full rounded-[3px] border border-ivory-200/12 bg-ink-950/70 px-3 py-2 text-[13px] tracking-[0.14em] text-ivory-100 outline-none transition-colors focus:border-gold-400/60"
            />
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

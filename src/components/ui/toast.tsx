'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils/format';

export type ToastTone = 'default' | 'success' | 'attention' | 'error';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  push: (toast: Omit<Toast, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  attention: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    // Components outside the provider still work: fall back to a no-op that logs.
    return { push: () => undefined, success: () => undefined, error: () => undefined, attention: () => undefined };
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const remove = useCallback((id: string) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((current) => [...current.slice(-3), { ...toast, id }]);
      const duration = toast.duration ?? (toast.tone === 'error' ? 7000 : 4600);
      window.setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      push,
      success: (title, description) => push({ title, description, tone: 'success' }),
      error: (title, description) => push({ title, description, tone: 'error' }),
      attention: (title, description) => push({ title, description, tone: 'attention' }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="pointer-events-none fixed bottom-6 right-6 z-[80] flex w-[min(92vw,380px)] flex-col gap-3" role="status" aria-live="polite">
              <AnimatePresence initial={false}>
                {toasts.map((toast) => (
                  <motion.div
                    key={toast.id}
                    layout
                    initial={{ opacity: 0, y: 14, scale: 0.985 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.99 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      'pointer-events-auto relative overflow-hidden rounded-[4px] border bg-ink-900/95 p-4 backdrop-blur-md shadow-lift',
                      toast.tone === 'success' && 'border-state-ok/35',
                      toast.tone === 'error' && 'border-state-risk/40',
                      toast.tone === 'attention' && 'border-gold-400/35',
                      (!toast.tone || toast.tone === 'default') && 'border-ivory-200/12',
                    )}
                  >
                    <div
                      className={cn(
                        'absolute inset-x-0 top-0 h-px',
                        toast.tone === 'success' && 'bg-state-ok/60',
                        toast.tone === 'error' && 'bg-state-risk/70',
                        toast.tone === 'attention' && 'bg-gold-400/60',
                        (!toast.tone || toast.tone === 'default') && 'bg-ivory-200/20',
                      )}
                    />
                    <p className="text-[13px] leading-snug text-ivory-100">{toast.title}</p>
                    {toast.description ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-graphite-300">{toast.description}</p> : null}
                    {toast.action ? (
                      <button
                        type="button"
                        onClick={() => {
                          toast.action?.onClick();
                          remove(toast.id);
                        }}
                        className="mt-3 text-[10.5px] uppercase tracking-[0.2em] text-gold-200 transition-colors hover:text-gold-100"
                      >
                        {toast.action.label}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => remove(toast.id)}
                      aria-label="Dismiss"
                      className="absolute right-3 top-3 text-graphite-400 transition-colors hover:text-ivory-100"
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                        <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.1" />
                      </svg>
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

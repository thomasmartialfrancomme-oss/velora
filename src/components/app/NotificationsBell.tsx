'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { NOTIFICATION_ICON } from '@/components/app/nav';
import { apiRequest } from '@/lib/http/client';
import { cn, relativeTime, truncate } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

type Note = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  severity: string;
  actionLabel: string | null;
  actionHref: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell({ initialUnread }: { initialUnread: number }) {
  const T = useT();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<Note[] | null>(null);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ items: Note[]; unread: number }>('/api/notifications');
      setItems(data.items);
      setUnread(data.unread);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && !items) void load();
  }, [open, items, load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function markAll() {
    try {
      await apiRequest('/api/notifications', { method: 'POST', body: { all: true } });
      setUnread(0);
      setItems((current) => (current ?? []).map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    } catch {
      /* the badge simply stays honest */
    }
  }

  async function markOne(note: Note) {
    if (note.readAt) return;
    setUnread((current) => Math.max(0, current - 1));
    setItems((current) => (current ?? []).map((item) => (item.id === note.id ? { ...item, readAt: new Date().toISOString() } : item)));
    try {
      await apiRequest('/api/notifications', { method: 'POST', body: { id: note.id } });
    } catch {
      /* ignore — the next refresh corrects it */
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unread ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        className={cn(
          'relative flex h-8 w-8 items-center justify-center rounded-[3px] border border-transparent text-graphite-300 transition-all duration-300 hover:border-ivory-200/12 hover:text-ivory-50',
          open && 'border-ivory-200/12 text-ivory-50',
        )}
      >
        <Bell size={15} strokeWidth={1.4} />
        {unread > 0 ? (
          <>
            <span className="absolute -right-0.5 -top-0.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-gold-400 px-[3px] text-[9px] font-medium leading-none text-ink-1000">
              {unread > 9 ? '9+' : unread}
            </span>
            <span className="absolute -right-0.5 -top-0.5 h-[15px] w-[15px] animate-pulse-soft rounded-full bg-gold-400/40" />
          </>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-[358px] origin-top-right overflow-hidden rounded-[6px] border border-ivory-200/[0.12] bg-ink-950/97 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.85)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-ivory-200/[0.08] px-5 py-3.5">
              <p className="label text-graphite-300">{T("Notifications")}</p>
              <button
                type="button"
                onClick={markAll}
                disabled={!unread}
                className="text-[10.5px] uppercase tracking-[0.16em] text-graphite-400 transition-colors hover:text-gold-200 disabled:opacity-40 disabled:hover:text-graphite-400"
              >
                Mark all read
              </button>
            </div>

            <div className="max-h-[380px] overflow-y-auto">
              {loading && !items ? (
                <div className="space-y-px">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex gap-3 px-5 py-4">
                      <span className="skeleton mt-1 h-4 w-4 rounded-full" />
                      <span className="flex-1 space-y-2">
                        <span className="skeleton block h-3 w-2/3" />
                        <span className="skeleton block h-2.5 w-full" />
                      </span>
                    </div>
                  ))}
                </div>
              ) : items && items.length ? (
                items.map((note) => {
                  const Icon = NOTIFICATION_ICON[note.kind] ?? Bell;
                  return (
                    <div key={note.id} className={cn('group flex gap-3.5 border-b border-ivory-200/[0.05] px-5 py-4 last:border-b-0', !note.readAt && 'bg-gold-400/[0.03]')}>
                      <span
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border',
                          note.severity === 'critical'
                            ? 'border-state-risk/40 text-state-risk'
                            : note.severity === 'attention'
                              ? 'border-gold-400/40 text-gold-300'
                              : 'border-ivory-200/10 text-graphite-300',
                        )}
                      >
                        <Icon size={13} strokeWidth={1.4} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-[12.5px] leading-snug', note.readAt ? 'text-graphite-200' : 'text-ivory-50')}>{note.title}</p>
                        {note.body ? <p className="mt-1 text-[11.5px] leading-relaxed text-graphite-500">{truncate(note.body, 130)}</p> : null}
                        <div className="mt-2 flex items-center gap-3">
                          <span className="text-[10px] uppercase tracking-[0.16em] text-graphite-600">{relativeTime(note.createdAt)}</span>
                          {note.actionHref ? (
                            <Link
                              href={note.actionHref}
                              onClick={() => {
                                markOne(note);
                                setOpen(false);
                              }}
                              className="text-[10.5px] uppercase tracking-[0.16em] text-gold-200 transition-colors hover:text-gold-100"
                            >
                              {note.actionLabel ?? 'Open'} →
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      {!note.readAt ? (
                        <button
                          type="button"
                          onClick={() => markOne(note)}
                          aria-label="Mark as read"
                          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400 transition-transform duration-300 hover:scale-150"
                        />
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <p className="px-5 py-9 text-center text-[12.5px] leading-relaxed text-graphite-500">{T("Nothing needs your attention.")}<br />
                  <span className="text-[11px] text-graphite-600">{T("That is the point of the office.")}</span>
                </p>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, CornerDownLeft, Search } from 'lucide-react';
import { NAV_ITEMS } from '@/components/app/nav';
import { apiRequest } from '@/lib/http/client';
import { cn } from '@/lib/utils/format';

type Hit = { id: string; group: string; title: string; detail: string; href: string };
type Row = { key: string; group: string; title: string; detail: string; href: string; kind: 'nav' | 'record' };

/**
 * One field for the whole office: jump to a screen, or search your own
 * records. Nothing here is a shortcut around permissions — the search endpoint
 * is scoped to the signed-in member on the server.
 */
export function CommandPalette({ open, onClose, role }: { open: boolean; onClose: () => void; role: 'owner' | 'admin' | 'staff' }) {
  const router = useRouter();
  const [term, setTerm] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(id);
    }
    setTerm('');
    setHits([]);
    setCursor(0);
    return undefined;
  }, [open]);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setHits([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const data = await apiRequest<{ hits: Hit[] }>(`/api/search?q=${encodeURIComponent(query)}`);
        if (!cancelled) setHits(data.hits ?? []);
      } catch {
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [term]);

  const rows = useMemo<Row[]>(() => {
    const lower = term.trim().toLowerCase();
    const nav: Row[] = NAV_ITEMS.filter((item) => !item.admin || role === 'admin')
      .filter((item) => !lower || item.label.toLowerCase().includes(lower) || item.href.includes(lower) || (item.hint ?? '').toLowerCase().includes(lower))
      .map((item) => ({ key: `nav-${item.href}`, group: 'Go to', title: item.label, detail: item.hint ?? item.href, href: item.href, kind: 'nav' as const }));

    const records: Row[] = hits.map((hit) => ({
      key: `rec-${hit.group}-${hit.id}`,
      group: hit.group,
      title: hit.title,
      detail: hit.detail,
      href: hit.href,
      kind: 'record' as const,
    }));

    return [...records, ...nav];
  }, [term, hits, role]);

  useEffect(() => setCursor(0), [term]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((current) => (rows.length ? (current + 1) % rows.length : 0));
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0));
      }
      if (event.key === 'Enter') {
        const row = rows[cursor];
        if (row) {
          event.preventDefault();
          onClose();
          router.push(row.href);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, rows, cursor, onClose, router]);

  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let lastGroup = '';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[70] flex items-start justify-center bg-ink-1000/75 px-4 pb-16 pt-[12vh] backdrop-blur-[6px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.995 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[600px] overflow-hidden rounded-[8px] border border-ivory-200/[0.13] bg-ink-950/98 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
          >
            <div className="flex items-center gap-3.5 border-b border-ivory-200/[0.08] px-5 py-4">
              <Search size={15} strokeWidth={1.4} className="text-graphite-500" />
              <input
                ref={inputRef}
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search residences, people, tasks — or jump to a screen"
                className="flex-1 bg-transparent text-[14px] text-ivory-50 outline-none placeholder:text-graphite-500"
                aria-label="Search"
                autoComplete="off"
                spellCheck={false}
              />
              {searching ? <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-gold-400" /> : null}
              <kbd className="hidden rounded-[3px] border border-ivory-200/12 px-1.5 py-0.5 text-[9.5px] tracking-[0.12em] text-graphite-500 sm:block">ESC</kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-2">
              {rows.length === 0 ? (
                <p className="px-5 py-10 text-center text-[12.5px] leading-relaxed text-graphite-500">
                  {term.trim().length >= 2 ? (
                    <>
                      Nothing in your records matches “{term.trim()}”.
                      <br />
                      <span className="text-[11px] text-graphite-600">Only your own household is searched.</span>
                    </>
                  ) : (
                    'Type two characters or more.'
                  )}
                </p>
              ) : (
                rows.map((row, index) => {
                  const showGroup = row.group !== lastGroup;
                  lastGroup = row.group;
                  return (
                    <div key={row.key}>
                      {showGroup ? <p className="label mb-1 mt-2 px-5 pt-2 text-graphite-600">{row.group}</p> : null}
                      <button
                        type="button"
                        data-index={index}
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => {
                          onClose();
                          router.push(row.href);
                        }}
                        className={cn(
                          'flex w-full items-center gap-4 px-5 py-2.5 text-left transition-colors duration-150',
                          cursor === index ? 'bg-ivory-100/[0.07]' : 'hover:bg-ivory-100/[0.03]',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[13px]', cursor === index ? 'text-ivory-50' : 'text-graphite-200')}>{row.title}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-graphite-500">{row.detail}</span>
                        </span>
                        {cursor === index ? (
                          row.kind === 'nav' ? (
                            <ArrowUpRight size={14} className="shrink-0 text-gold-300" strokeWidth={1.4} />
                          ) : (
                            <CornerDownLeft size={13} className="shrink-0 text-graphite-400" strokeWidth={1.4} />
                          )
                        ) : null}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-ivory-200/[0.08] px-5 py-3 text-[10.5px] uppercase tracking-[0.16em] text-graphite-600">
              <span className="flex items-center gap-4">
                <span>↑ ↓ to move</span>
                <span>↵ to open</span>
              </span>
              <span>Your records only</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

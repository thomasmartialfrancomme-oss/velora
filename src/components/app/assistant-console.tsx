'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

type Outcome = {
  conversationId?: string | null;
  degraded?: boolean;
  result?: { kind?: string; headline?: string; requiresHuman?: boolean };
  plan?: { name?: string; requestLimit?: number | 'unlimited'; requestsUsed?: number };
};

/**
 * The command line. It holds no answer of its own: after a request the route is
 * refreshed and the reply is rendered from the stored conversation, so what you
 * read is exactly what the office recorded.
 */
export function AssistantConsole({
  conversationId,
  suggestions,
  firstName,
  busyLabel,
}: {
  conversationId: string | null;
  suggestions: string[];
  firstName: string;
  busyLabel?: string;
}) {
  const T = useT();
  const router = useRouter();
  const toast = useToast();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(0);

  const max = 600;

  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setStage((current) => (current + 1) % 4), 520);
    return () => window.clearInterval(id);
  }, [pending]);

  const stages = ['Reading your records', 'Checking what is already in motion', 'Assembling the steps', 'Writing it into the ledger'];

  async function send() {
    const request = text.trim();
    if (request.length < 8) {
      setError('Say a little more — a date, a residence, or what you want arranged.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const data = await apiRequest<Outcome>('/api/ai/request', {
        method: 'POST',
        body: { request, conversationId },
      });
      toast.success('The office has answered', data?.result?.requiresHuman ? 'Some steps still need a person.' : 'Everything it could open is open.');
      setText('');
      const next = data?.conversationId ? `/ai?c=${data.conversationId}` : '/ai';
      router.replace(next);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'The coordinator could not be reached.');
    } finally {
      setPending(false);
      setStage(0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-[6px] border border-ivory-200/[0.1] bg-ink-950">
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/45 to-transparent" aria-hidden />

      <div className="flex items-start gap-4 px-6 pb-4 pt-6 sm:px-8">
        <span className="mt-[3px] select-none font-serif text-[1.05rem] leading-none text-gold-300/90">›</span>
        <textarea
          ref={areaRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value.slice(0, max));
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send();
            }
          }}
          rows={3}
          spellCheck={false}
          placeholder={`${firstName ? `${firstName}, tell me` : 'Tell me'} what should happen — a date, a residence, who is involved…`}
          aria-label="Instruction for the coordinator"
          className="min-h-[76px] w-full flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-ivory-50 outline-none placeholder:text-graphite-600"
        />
      </div>

      {error ? (
        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert" className="px-6 pb-3 text-[12.5px] text-state-risk sm:px-8">
          {error}
        </motion.p>
      ) : null}

      {pending ? (
        <p className="flex items-center gap-2.5 px-6 pb-3 text-[11.5px] text-graphite-400 sm:px-8">
          <Loader2 size={12} className="animate-spin text-gold-300" />
          {busyLabel ?? stages[stage]}…
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-ivory-200/[0.07] px-6 py-4 sm:px-8">
        <span className="label mr-1 text-graphite-600">{T("Try")}</span>
        {suggestions.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => {
              setText(suggestion);
              areaRef.current?.focus();
              setError(null);
            }}
            className="rounded-full border border-ivory-200/[0.1] px-3 py-1.5 text-[11.5px] text-graphite-300 transition-all duration-300 ease-lux hover:border-gold-400/45 hover:text-gold-100"
          >
            {suggestion}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-4">
          <span className={cn('text-[10.5px] tabular-nums tracking-[0.14em]', text.length > max - 80 ? 'text-gold-200' : 'text-graphite-600')}>
            {text.length}/{max}
          </span>
          <Button size="md" onClick={send} loading={pending} icon={<ArrowUp size={13} strokeWidth={1.6} />}>{T("Send")}</Button>
        </span>
      </div>
    </div>
  );
}

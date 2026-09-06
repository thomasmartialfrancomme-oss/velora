'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight, Copy, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField, TextArea } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

/* ============================================================ sub-nav */

export function AdminSubnav({ items }: { items: { href: string; label: string; count?: number }[] }) {
  const T = useT();
  const pathname = usePathname();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-ivory-200/[0.08] px-1 no-scrollbar" aria-label="Private office console">
      {items.map((item) => {
        const active = item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative shrink-0 px-4 py-3 text-[11px] uppercase tracking-[0.2em] transition-colors duration-300 ease-lux',
              active ? 'text-ivory-50' : 'text-graphite-400 hover:text-ivory-200',
            )}
          >
            <span className="flex items-center gap-2">
              {item.label}
              {item.count !== undefined && item.count > 0 ? (
                <span className={cn('rounded-[2px] px-1.5 py-px text-[10px] tabular-nums', active ? 'bg-gold-400/20 text-gold-100' : 'bg-ivory-100/[0.06] text-graphite-300')}>
                  {item.count}
                </span>
              ) : null}
            </span>
            {active ? <span className="absolute inset-x-3 -bottom-px h-px bg-gold-400/70" aria-hidden /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

/* ============================================================ access requests */

const REQUEST_STATUSES = [
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'invited', label: 'Send an invite' },
  { value: 'declined', label: 'Decline' },
  { value: 'archived', label: 'Archive' },
];

export function AccessRequestTriage({ id, applicant }: { id: string; applicant: string }) {
  const T = useT();
  const toast = useToast();
  const [status, setStatus] = useState('reviewing');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ email: string; link: string } | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const data = await apiRequest<{ invite?: { email: string; link: string } | null }>(`/api/admin/access-requests/${id}`, {
        method: 'PATCH',
        body: { status, reviewerNote: note || null },
      });
      setInvite(data?.invite ?? null);
      toast.success('Request triaged', status === 'invited' ? 'A placeholder account and a reset link exist. The invite itself is yours to send.' : `${applicant} moved to ${status}.`);
      if (status !== 'invited') setNote('');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'The request could not be updated.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-ivory-200/[0.07] pt-4">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <SelectField label="Decision" value={status} onChange={(event) => setStatus(event.target.value)} options={REQUEST_STATUSES} />
        <TextArea label="Note for the file" rows={2} max={400} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why the decision, and anything the office owes them." />
      </div>

      {error ? <p className="text-[12.5px] text-state-risk">{error}</p> : null}

      <div className="flex items-center justify-between gap-4">
        <p className="max-w-md text-[11.5px] leading-relaxed text-graphite-500">{T("Inviting creates an account with no usable passphrase — only a reset link the applicant sets themselves. Nothing is emailed from this build.")}</p>
        <Button size="sm" loading={pending} onClick={() => void save()}>{T("Record decision")}</Button>
      </div>

      {invite ? (
        <div className="rounded-[4px] border border-gold-400/30 bg-gold-400/[0.05] px-4 py-3.5">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gold-300/90">
            <KeyRound size={12} strokeWidth={1.5} /> Invitation link for {invite.email}
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <code className="min-w-0 flex-1 truncate rounded-[3px] border border-ivory-200/10 bg-ink-950/80 px-3 py-2 text-[11.5px] text-graphite-100">
              {typeof window === 'undefined' ? invite.link : `${window.location.origin}${invite.link}`}
            </code>
            <Button
              size="sm"
              variant="ghost"
              icon={<Copy size={12} strokeWidth={1.5} />}
              onClick={() => {
                void navigator.clipboard?.writeText(`${window.location.origin}${invite.link}`);
                toast.success('Link copied', 'Send it yourself — no mailer is connected in this build.');
              }}
            >
              Copy
            </Button>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-graphite-400">{T("Valid fourteen days. The account stays in “invited” until the passphrase is chosen, so an undelivered link expires harmlessly.")}</p>
        </div>
      ) : null}
    </div>
  );
}

/* ============================================================ tickets */

const TICKET_STATUSES = [
  { value: 'in_review', label: 'Being prepared' },
  { value: 'answered', label: 'Answered' },
  { value: 'closed', label: 'Closed' },
  { value: 'open', label: 'Back to the queue' },
];

export function TicketReply({ id, requester, status, assignee }: { id: string; requester: string; status: string; assignee: string | null }) {
  const T = useT();
  const toast = useToast();
  const [reply, setReply] = useState('');
  const [next, setNext] = useState(status === 'open' ? 'in_review' : 'answered');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setPending(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/tickets/${id}`, {
        method: 'PATCH',
        body: { status: next, ...(reply.trim() ? { reply: reply.trim(), assignee: assignee ?? 'Private office' } : {}) },
      });
      setReply('');
      toast.success('Ticket updated', next === 'answered' && reply.trim() ? `${requester} receives the answer as a message.` : 'The state is recorded.');
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'The ticket could not be updated.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 border-t border-ivory-200/[0.07] pt-4">
      <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
        <SelectField label="Move to" value={next} onChange={(event) => setNext(event.target.value)} options={TICKET_STATUSES} />
        <TextArea
          label="Answer"
          rows={3}
          max={1200}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="What the office did or will do, in the member’s own terms."
          hint="Left empty, only the state changes and nothing is sent to the member."
        />
      </div>
      {error ? <p className="text-[12.5px] text-state-risk">{error}</p> : null}
      <div className="flex items-center justify-between gap-4">
        <p className="text-[11.5px] text-graphite-500">{T("An answer written here appears in the member’s correspondence thread and message list.")}</p>
        <Button size="sm" loading={pending} onClick={() => void save()}>{T("Save")}</Button>
      </div>
    </div>
  );
}

/** A quiet external link used in console panels. */
export function ConsoleLink({ href, children }: { href: string; children: React.ReactNode }) {
  const T = useT();
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-gold-200 transition-colors hover:text-gold-100">
      {children}
      <ArrowUpRight size={11} className="transition-transform duration-300 group-hover:translate-x-0.5" />
    </Link>
  );
}

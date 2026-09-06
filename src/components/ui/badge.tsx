import { cn } from '@/lib/utils/format';
import { getT } from '@/lib/i18n/server';;

export type Tone = 'neutral' | 'ok' | 'info' | 'attention' | 'risk' | 'gold';

const TONES: Record<Tone, string> = {
  neutral: 'border-ivory-200/12 text-graphite-200 bg-ivory-100/[0.03]',
  ok: 'border-state-ok/30 text-state-ok bg-state-ok/[0.07]',
  info: 'border-state-info/28 text-state-info bg-state-info/[0.06]',
  attention: 'border-gold-400/35 text-gold-200 bg-gold-400/[0.07]',
  risk: 'border-state-risk/35 text-state-risk bg-state-risk/[0.07]',
  gold: 'border-gold-400/40 text-gold-100 bg-gold-400/[0.10]',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-[3px] text-[10px] uppercase tracking-[0.18em] leading-none whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1 w-1 rounded-full bg-current" /> : null}
      {typeof children === 'string' ? getT()(children) : children}
    </span>
  );
}

/**
 * Same markup, no lookup: for the rare badge rendered inside a client component,
 * where the request's language is not reachable and the text is data (a
 * residence state in the marketing showcase) rather than an interface label.
 */
export function RawBadge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: React.ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-[3px] text-[10px] uppercase tracking-[0.18em] leading-none whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1 w-1 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  operational: 'ok',
  available: 'ok',
  on_site: 'ok',
  ready: 'ok',
  confirmed: 'ok',
  active: 'ok',
  valid: 'ok',
  paid: 'ok',
  done: 'ok',
  approved: 'ok',
  completed: 'ok',
  attention: 'attention',
  pending: 'attention',
  requested: 'attention',
  expiring: 'attention',
  in_progress: 'info',
  in_review: 'info',
  proposed: 'info',
  recorded: 'info',
  awaiting_confirmation: 'gold',
  requires_confirmation: 'gold',
  blocked: 'risk',
  maintenance: 'risk',
  expired: 'risk',
  past_due: 'risk',
  disputed: 'risk',
  unreachable: 'risk',
  suspended: 'risk',
  standby: 'neutral',
  stored: 'neutral',
  off_duty: 'neutral',
  on_leave: 'neutral',
  cancelled: 'neutral',
  draft: 'neutral',
  declined: 'neutral',
  archived: 'neutral',
  new: 'gold',
  reviewing: 'attention',
  invited: 'ok',
  open: 'attention',
  answered: 'ok',
  closed: 'neutral',
  urgent: 'risk',
  critical: 'risk',
  high: 'attention',
  normal: 'neutral',
  low: 'neutral',
  in_service: 'attention',
  in_use: 'info',
  unavailable: 'risk',
  paused: 'neutral',
  trialing: 'info',
};

export function toneForStatus(status: string | null | undefined): Tone {
  if (!status) return 'neutral';
  return STATUS_TONE[status] ?? 'neutral';
}

export function StatusDot({ status, className }: { status: string | null | undefined; className?: string }) {
  const tone = toneForStatus(status);
  const color =
    tone === 'ok' ? 'bg-state-ok' : tone === 'attention' ? 'bg-gold-400' : tone === 'risk' ? 'bg-state-risk' : tone === 'info' ? 'bg-state-info' : 'bg-graphite-400';
  const pulse = tone === 'risk' || tone === 'attention';
  return (
    <span className={cn('relative inline-flex h-1.5 w-1.5', className)} aria-hidden>
      <span className={cn('absolute inset-0 rounded-full', color)} />
      {pulse ? <span className={cn('absolute inset-0 rounded-full opacity-60 animate-pulse-soft', color)} /> : null}
    </span>
  );
}

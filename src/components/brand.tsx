import Link from 'next/link';
import { cn } from '@/lib/utils/format';

/**
 * VELORA identity mark: a hairline diamond with an off-centre vertical — a
 * monogram rather than an icon. Scales from a favicon to a hero without a hint
 * of decoration, and is drawn inline so it never needs a network request.
 */
export function VeloraMark({ size = 22, className, tone = 'gold' }: { size?: number; className?: string; tone?: 'gold' | 'ivory' | 'ink' }) {
  const stroke = tone === 'gold' ? 'rgba(201,169,106,0.9)' : tone === 'ink' ? 'rgba(13,15,19,0.85)' : 'rgba(247,243,234,0.9)';
  const faint = tone === 'gold' ? 'rgba(201,169,106,0.35)' : tone === 'ink' ? 'rgba(13,15,19,0.3)' : 'rgba(247,243,234,0.3)';
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={cn('shrink-0', className)} role="img" aria-label="VELORA">
      <path d="M16 2.2L29.8 16L16 29.8L2.2 16L16 2.2Z" stroke={faint} strokeWidth="0.8" />
      <path d="M9.6 11.2L16 21.6l6.4-10.4" stroke={stroke} strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="8.4" r="0.9" fill={stroke} />
    </svg>
  );
}

export function Wordmark({
  className,
  tone = 'ivory',
  showPrivate = true,
  size = 'md',
}: {
  className?: string;
  tone?: 'ivory' | 'ink' | 'muted';
  showPrivate?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const textSize = { sm: 'text-[13px] tracking-[0.34em]', md: 'text-[15px] tracking-[0.4em]', lg: 'text-[19px] tracking-[0.44em]' }[size];
  return (
    <span className={cn('inline-flex items-baseline gap-2 font-sans font-medium uppercase', textSize, className)}>
      <span className={tone === 'ink' ? 'text-ink-950' : tone === 'muted' ? 'text-graphite-200' : 'text-ivory-50'}>Velora</span>
      {showPrivate ? (
        <span className={cn('text-[0.62em] tracking-[0.3em]', tone === 'ink' ? 'text-ink-950/55' : 'text-gold-300/85')}>Private</span>
      ) : null}
    </span>
  );
}

export function BrandLockup({
  className,
  tone = 'ivory',
  size = 'md',
  href,
  wordmark = true,
  showPrivate = true,
}: {
  className?: string;
  tone?: 'ivory' | 'ink' | 'muted';
  size?: 'sm' | 'md' | 'lg';
  /** Wrap the lockup in a link (used by headers and the app rail). */
  href?: string;
  /** Show or hide the “PRIVATE” half of the wordmark. */
  showPrivate?: boolean;
  wordmark?: boolean;
}) {
  const inner = (
    <>
      <VeloraMark size={size === 'lg' ? 28 : size === 'sm' ? 18 : 22} tone={tone === 'ink' ? 'ink' : 'gold'} />
      {wordmark ? <Wordmark tone={tone} size={size} showPrivate={showPrivate} /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={cn('group inline-flex items-center gap-3 transition-opacity duration-300 hover:opacity-85', className)} aria-label="VELORA PRIVATE">
        {inner}
      </Link>
    );
  }
  return <span className={cn('inline-flex items-center gap-3', className)}>{inner}</span>;
}

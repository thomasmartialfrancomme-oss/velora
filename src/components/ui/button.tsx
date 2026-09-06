import { forwardRef } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold-outline';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ivory-100 text-ink-1000 hover:bg-ivory-50 border border-ivory-100 disabled:bg-ink-750 disabled:text-graphite-300 disabled:border-transparent',
  'gold-outline':
    'bg-transparent text-gold-200 border border-gold-400/45 hover:border-gold-300 hover:bg-gold-400/[0.08] hover:text-gold-100',
  secondary:
    'bg-ink-850/80 text-ivory-200 border border-ivory-200/10 hover:border-ivory-200/25 hover:bg-ink-800 hover:text-ivory-50',
  ghost: 'bg-transparent text-graphite-200 border border-transparent hover:text-ivory-100 hover:bg-ivory-100/[0.05]',
  danger: 'bg-transparent text-state-risk border border-state-risk/40 hover:bg-state-risk/10 hover:text-ivory-100',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[11px] tracking-[0.18em]',
  md: 'h-10 px-5 text-[11.5px] tracking-[0.2em]',
  lg: 'h-12 px-7 text-[12px] tracking-[0.24em]',
};

const BASE =
  'group relative inline-flex items-center justify-center gap-2.5 uppercase font-medium select-none rounded-[3px] transition-all duration-300 ease-lux disabled:opacity-60 active:translate-y-[1px] focus-visible:outline-none';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  href?: string;
  asLink?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, href, asLink, icon, trailingIcon, children, disabled, ...rest },
  ref,
) {
  const classes = cn(BASE, VARIANTS[variant], SIZES[size], className);

  if (href && asLink !== false) {
    return (
      <Link href={href} className={classes} aria-disabled={disabled || loading}>
        {loading ? <Spinner /> : icon}
        <span className="relative">{children}</span>
        {trailingIcon}
      </Link>
    );
  }

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon}
      <span className="relative">{children}</span>
      {trailingIcon}
    </button>
  );
});

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent opacity-80" aria-hidden />
  );
}

export function IconButton({
  label,
  className,
  children,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-9 w-9 items-center justify-center rounded-[3px] border border-transparent text-graphite-200',
        'transition-all duration-300 ease-lux hover:border-ivory-200/15 hover:bg-ivory-100/[0.04] hover:text-ivory-50',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

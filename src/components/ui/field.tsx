'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils/format';
import { useT } from '@/lib/i18n/context';

const CONTROL =
  'w-full rounded-[3px] border border-ivory-200/12 bg-ink-950/70 px-3.5 py-2.5 text-[14px] text-ivory-100 ' +
  'placeholder:text-graphite-500 transition-all duration-300 ease-lux outline-none ' +
  'hover:border-ivory-200/20 focus:border-gold-400/60 focus:bg-ink-950';

export function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
  counter,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  counter?: string;
}) {
  // FieldShell is the single frame around every control in the product, so the
  // words that belong to a field are translated here rather than at the forty
  // call sites that supply them.
  const T = useT();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={htmlFor} className="text-[10.5px] uppercase tracking-[0.22em] text-graphite-300">
            {label ? T(label) : null}
            {required ? <span className="ml-1 text-gold-400">*</span> : null}
          </label>
          {counter ? <span className="text-[10.5px] tabular-nums text-graphite-500">{counter}</span> : null}
        </div>
      ) : null}
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-[12px] leading-snug text-state-risk">
          <span aria-hidden className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-state-risk" />
          {T(error)}
        </p>
      ) : hint ? (
        <p className="text-[12px] leading-snug text-graphite-400">{T(hint)}</p>
      ) : null}
    </div>
  );
}

interface BaseProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  name?: string;
  disabled?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, BaseProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> & { className?: string }>(
  function TextField({ label, error, hint, required, className, name, ...rest }, ref) {
    const id = useId();
    return (
      <FieldShell label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
        <input
          ref={ref}
          id={id}
          name={name ?? rest.id}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, error && 'border-state-risk/60 focus:border-state-risk')}
          {...rest}
        />
      </FieldShell>
    );
  },
);

export const TextArea = forwardRef<
  HTMLTextAreaElement,
  BaseProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'> & { className?: string; max?: number }
>(function TextArea({ label, error, hint, required, className, rows = 4, max, value, ...rest }, ref) {
  const id = useId();
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} required={required} className={className} counter={max ? `${length}/${max}` : undefined}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        maxLength={max}
        value={value}
        aria-invalid={error ? true : undefined}
        className={cn(CONTROL, 'resize-y leading-relaxed', error && 'border-state-risk/60 focus:border-state-risk')}
        {...rest}
      />
    </FieldShell>
  );
});

export function SelectField({
  label,
  error,
  hint,
  required,
  className,
  options,
  placeholder,
  ...rest
}: BaseProps & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className'> & { className?: string; options: { value: string; label: string }[]; placeholder?: string }) {
  const id = useId();
  return (
    <FieldShell label={label} htmlFor={id} error={error} hint={hint} required={required} className={className}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL, 'appearance-none pr-9', error && 'border-state-risk/60 focus:border-state-risk')}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-graphite-400" fill="none" aria-hidden>
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </div>
    </FieldShell>
  );
}

export function ToggleField({
  label,
  description,
  checked,
  onChange,
  className,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn('group flex cursor-pointer items-start justify-between gap-5 border-b border-ivory-200/[0.06] py-3.5 last:border-b-0', disabled && 'opacity-60', className)}>
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ivory-100">{label}</span>
        {description ? <span className="mt-1 block text-[12.5px] leading-relaxed text-graphite-400">{description}</span> : null}
      </span>
      <span className="relative mt-0.5 flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={label}
        />
        <span className="absolute inset-0 rounded-full border border-ivory-200/15 bg-ink-800 transition-all duration-400 ease-lux peer-checked:border-gold-400/60 peer-checked:bg-gold-400/20" />
        <span className="relative ml-[3px] h-[14px] w-[14px] rounded-full bg-graphite-200 transition-all duration-400 ease-lux peer-checked:translate-x-4 peer-checked:bg-gold-200" />
      </span>
    </label>
  );
}

export function SegmentedField({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <FieldShell label={label}>
      <div className={cn('inline-flex flex-wrap gap-1 rounded-[3px] border border-ivory-200/10 bg-ink-950/60 p-1', className)}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              'rounded-[2px] px-3 py-1.5 text-[10.5px] uppercase tracking-[0.16em] transition-all duration-300 ease-lux',
              value === option.value ? 'bg-ivory-100/10 text-ivory-50' : 'text-graphite-400 hover:text-ivory-200',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </FieldShell>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { FieldShell, SelectField, TextArea, TextField, ToggleField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { cn, label as humanise } from '@/lib/utils/format';

/* ------------------------------------------------------------- the spec */

export type FieldType = 'text' | 'textarea' | 'select' | 'toggle' | 'date' | 'datetime' | 'money' | 'number' | 'tags' | 'repeat' | 'static';

export interface FieldSpec {
  key: string;
  label?: string;
  /** defaults to 'text' */
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** 1 = half width, 2 = full width */
  span?: 1 | 2;
  rows?: number;
  max?: number;
  min?: number;
  step?: number;
  /** for repeat fields */
  subfields?: FieldSpec[];
  itemLabel?: string;
  addLabel?: string;
  /** shown instead of an input (static) */
  value?: string;
}

type Values = Record<string, unknown>;

function coerceOut(value: unknown, field: FieldSpec): unknown {
  switch (field.type ?? 'text') {
    case 'date': {
      if (!value) return null;
      const date = new Date(`${String(value)}T12:00:00.000Z`);
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    case 'datetime': {
      if (!value) return null;
      const date = new Date(String(value));
      return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    case 'tags': {
      if (Array.isArray(value)) return value;
      return String(value ?? '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 8);
    }
    case 'number': {
      if (value === '' || value === null || value === undefined) return undefined;
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'money': {
      if (value === '' || value === null || value === undefined) return undefined;
      return String(value).replace(/[^\d.,-]/g, '');
    }
    case 'toggle':
      return Boolean(value);
    default: {
      if (value === '' || value === null || value === undefined) return null;
      return String(value).trim();
    }
  }
}

function coerceIn(value: unknown, field: FieldSpec): unknown {
  const type = field.type ?? 'text';
  if (value === null || value === undefined) return type === 'toggle' ? false : type === 'repeat' ? [] : '';
  switch (type) {
    case 'tags':
      return Array.isArray(value) ? value.join(', ') : String(value);
    case 'date':
      return typeof value === 'string' ? value.slice(0, 10) : '';
    case 'datetime': {
      if (typeof value !== 'string') return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const offset = date.getTimezoneOffset();
      const local = new Date(date.getTime() - offset * 60_000);
      return local.toISOString().slice(0, 16);
    }
    case 'money':
      return typeof value === 'number' ? (value / 100).toFixed(2).replace(/\.00$/, '') : String(value);
    case 'toggle':
      return Boolean(value);
    default:
      return value;
  }
}

/* --------------------------------------------------------------- the form */

export function RecordForm({
  fields,
  path,
  id,
  title,
  eyebrow,
  description,
  defaults,
  initial,
  trigger,
  submitLabel,
  onDone,
  inline = false,
  size = 'md',
  method,
}: {
  fields: FieldSpec[];
  path: string;
  /** when set the form PATCHes `${path}/${id}` instead of POSTing */
  id?: string | null;
  title: string;
  eyebrow?: string;
  description?: string;
  defaults?: Values;
  initial?: Values;
  trigger?: React.ReactNode;
  submitLabel?: string;
  onDone?: () => void;
  inline?: boolean;
  size?: 'sm' | 'md' | 'lg';
  method?: 'POST' | 'PATCH';
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(id);
  const endpoint = editing ? `${path}/${id}` : path;

  // Normalise once: a spec may omit `type` and mean 'text'.
  const specs = useMemo<FieldSpec[]>(() => fields.map((field) => ({ ...field, type: field.type ?? 'text' })), [fields]);

  const seed = useMemo<Values>(() => {
    const base: Values = {};
    for (const field of specs) {
      const source = (initial ?? {})[field.key] ?? (defaults ?? {})[field.key];
      base[field.key] = coerceIn(source, field);
    }
    return base;
  }, [specs, initial, defaults]);

  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(seed);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [general, setGeneral] = useState<string | null>(null);

  useEffect(() => {
    setValues(seed);
    setErrors({});
    setGeneral(null);
  }, [seed, open]);

  const setField = useCallback((key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const submit = useCallback(async () => {
    setPending(true);
    setGeneral(null);
    const body: Values = {};
    for (const field of specs) {
      if (field.type === 'static') continue;
      const value = coerceOut(values[field.key], field);
      if (value === undefined) continue;
      body[field.key] = value;
    }
    // repeat: drop empty rows entirely
    for (const field of specs) {
      if (field.type === 'repeat' && Array.isArray(body[field.key])) {
        body[field.key] = (body[field.key] as Values[]).filter((row) => Object.values(row).some((v) => v !== '' && v !== null));
      }
    }

    try {
      await apiRequest(endpoint, { method: method ?? (editing ? 'PATCH' : 'POST'), body });
      toast.success(
        editing ? 'Updated' : 'Saved',
        `${title.replace(/^(Add|Edit|New)\s+/i, '')} recorded.`,
      );
      setOpen(false);
      onDone?.();
      router.refresh();
      return true;
    } catch (error) {
      if (error instanceof ApiClientError) {
        setErrors(error.fields);
        setGeneral(error.message);
      } else {
        setGeneral((error as Error)?.message ?? 'That could not be saved.');
      }
      return false;
    } finally {
      setPending(false);
    }
  }, [editing, endpoint, specs, method, onDone, router, title, toast, values]);

  const form = (
    <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
      {specs.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={values[field.key]}
          error={errors[field.key]}
          onChange={(value) => setField(field.key, value)}
        />
      ))}
      {general ? (
        <div className="col-span-full rounded-[3px] border border-state-risk/35 bg-state-risk/[0.06] px-4 py-3 text-[12.5px] leading-relaxed text-state-risk">
          {general}
        </div>
      ) : null}
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-6">
        {form}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => setValues(seed)}>
            Reset
          </Button>
          <Button type="button" size="sm" onClick={submit} loading={pending}>
            {submitLabel ?? (editing ? 'Save changes' : 'Create')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)} className="contents">
          {trigger}
        </span>
      ) : (
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)} icon={<Plus size={13} strokeWidth={1.5} />}>
          {submitLabel ?? `Add ${humanise(title.replace(/^(Add|Edit|New)\s+/i, ''), {}).toLowerCase()}`}
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={title}
        eyebrow={eyebrow}
        description={description}
        size={size}
        loading={pending}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={pending}>
              {submitLabel ?? (editing ? 'Save changes' : 'Record it')}
            </Button>
          </>
        }
      >
        {form}
      </Modal>
    </>
  );
}

function FieldRenderer({ field, value, error, onChange }: { field: FieldSpec; value: unknown; error?: string; onChange: (value: unknown) => void }) {
  const type = field.type ?? 'text';
  const spanClass = field.span === 2 || ['textarea', 'repeat', 'tags'].includes(type) ? 'sm:col-span-2' : 'sm:col-span-1';

  if (type === 'static') {
    return (
      <FieldShell label={field.label} className={spanClass}>
        <p className="rounded-[3px] border border-ivory-200/10 bg-ink-950/50 px-3.5 py-2.5 text-[13.5px] text-ivory-200">{field.value ?? '—'}</p>
      </FieldShell>
    );
  }

  if (type === 'textarea') {
    return (
      <TextArea
        className={spanClass}
        label={field.label}
        hint={field.hint}
        error={error}
        required={field.required}
        rows={field.rows ?? 4}
        max={field.max}
        placeholder={field.placeholder}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (type === 'select') {
    return (
      <SelectField
        className={spanClass}
        label={field.label}
        hint={field.hint}
        error={error}
        required={field.required}
        options={field.options ?? []}
        placeholder={field.placeholder}
        value={String(value ?? '')}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  if (type === 'toggle') {
    return (
      <div className={cn('sm:col-span-2', spanClass)}>
        <ToggleField label={field.label ?? ''} description={field.hint} checked={Boolean(value)} onChange={onChange} />
      </div>
    );
  }

  if (type === 'repeat') {
    const rows = Array.isArray(value) ? (value as Values[]) : [];
    const blank: Values = Object.fromEntries((field.subfields ?? []).map((sub) => [sub.key, '']));
    return (
      <FieldShell label={field.label} hint={field.hint} className="sm:col-span-2">
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {rows.map((row, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="relative rounded-[4px] border border-ivory-200/10 bg-ink-950/40 p-4">
                  <p className="label mb-3 text-graphite-400">
                    {field.itemLabel ?? 'Entry'} {index + 1}
                  </p>
                  <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                    {(field.subfields ?? []).map((sub) => (
                      <FieldRenderer
                        key={`${index}-${sub.key}`}
                        field={{ ...sub, label: sub.label, span: undefined }}
                        value={row[sub.key]}
                        error={error ? undefined : undefined}
                        onChange={(next) => {
                          const updated = [...rows];
                          updated[index] = { ...row, [sub.key]: next };
                          onChange(updated);
                        }}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    aria-label="Remove entry"
                    onClick={() => onChange(rows.filter((_, i) => i !== index))}
                    className="absolute right-3 top-3 rounded-[3px] p-1.5 text-graphite-400 transition-colors hover:bg-state-risk/10 hover:text-state-risk"
                  >
                    <Trash2 size={13} strokeWidth={1.4} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => onChange([...rows, { ...blank }])}
            className="inline-flex items-center gap-2 rounded-[3px] border border-dashed border-ivory-200/15 px-3.5 py-2 text-[10.5px] uppercase tracking-[0.18em] text-graphite-300 transition-all duration-300 hover:border-gold-400/45 hover:text-gold-200"
          >
            <Plus size={12} strokeWidth={1.5} />
            {field.addLabel ?? 'Add entry'}
          </button>
        </div>
      </FieldShell>
    );
  }

  return (
    <TextField
      className={spanClass}
      label={field.label}
      hint={field.hint}
      error={error}
      required={field.required}
      type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'datetime' ? 'datetime-local' : 'text'}
      inputMode={type === 'money' ? 'decimal' : undefined}
      step={field.step ?? (type === 'money' ? '0.01' : undefined)}
      min={field.min}
      placeholder={type === 'money' ? '18 420' : field.placeholder}
      value={String(value ?? '')}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

/* ------------------------------------------------------- destructive UI */

export function DeleteButton({
  path,
  label: buttonLabel = 'Remove',
  title,
  body,
  onDone,
  variant = 'ghost',
  size = 'sm',
}: {
  path: string;
  label?: string;
  title: string;
  body: React.ReactNode;
  onDone?: () => void;
  variant?: 'ghost' | 'danger' | 'secondary';
  size?: 'sm' | 'md';
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={() => setOpen(true)}
        className={variant === 'ghost' ? 'text-graphite-300 hover:text-state-risk' : undefined}
      >
        {buttonLabel}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        body={body}
        confirmLabel="Remove it"
        busy={pending}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          setPending(true);
          try {
            await apiRequest(path, { method: 'DELETE' });
            toast.success('Removed', 'Your records were updated.');
            setOpen(false);
            onDone?.();
            router.refresh();
          } catch (error) {
            toast.error('Could not remove that', error instanceof ApiClientError ? error.message : 'Try again in a moment.');
          } finally {
            setPending(false);
          }
        }}
      />
    </>
  );
}

/** One-press server action with a spinner and a toast (task done, approve, cancel…). */
export function QuickAction({
  path,
  body,
  label: buttonLabel,
  successMessage,
  variant = 'ghost',
  size = 'sm',
  icon,
  onDone,
  confirm,
  method,
}: {
  path: string;
  body?: unknown;
  /** QuickActions post by default; status changes on some resources patch. */
  method?: 'POST' | 'PATCH' | 'DELETE';
  label: string;
  successMessage?: string;
  variant?: 'ghost' | 'primary' | 'secondary' | 'danger' | 'gold-outline';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
  onDone?: () => void;
  confirm?: { title: string; body: React.ReactNode; confirmLabel?: string };
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  const run = useCallback(async () => {
    setPending(true);
    try {
      const data = (await apiRequest(path, { method: method ?? 'POST', body })) as { message?: string } | null;
      toast.success(successMessage ?? data?.message ?? 'Recorded.');
      onDone?.();
      router.refresh();
    } catch (error) {
      toast.error('Not completed', error instanceof ApiClientError ? error.message : 'Please try again.');
    } finally {
      setPending(false);
    }
  }, [body, method, onDone, path, router, successMessage, toast]);

  if (confirm) {
    return (
      <>
        <Button type="button" variant={variant} size={size} icon={icon} onClick={() => setOpen(true)} loading={pending}>
          {buttonLabel}
        </Button>
        <ConfirmDialog
          open={open}
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          tone={variant === 'danger' ? 'danger' : 'primary'}
          busy={pending}
          onCancel={() => setOpen(false)}
          onConfirm={run}
        />
      </>
    );
  }

  return (
    <Button type="button" variant={variant} size={size} icon={icon} onClick={run} loading={pending}>
      {buttonLabel}
    </Button>
  );
}

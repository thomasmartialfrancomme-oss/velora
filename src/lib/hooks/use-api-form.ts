'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError, apiRequest, type RequestOptions } from '@/lib/http/client';
import { useToast } from '@/components/ui/toast';

export type FieldErrors = Record<string, string>;

export interface UseApiFormOptions<TValues extends Record<string, unknown>> {
  path: string;
  method?: 'POST' | 'PATCH' | 'DELETE';
  initialValues?: TValues;
  /** transform before sending (e.g. '' → null) */
  prepare?: (values: TValues) => Record<string, unknown>;
  success?: { message: string; description?: string };
  onDone?: (data: unknown) => void | Promise<void>;
  /** client-side pre-flight; return a map of field errors */
  validate?: (values: TValues) => FieldErrors;
}

/**
 * One form hook for the whole product: pending state, inline field errors,
 * a toast on success, optimistic-free refresh of the server components, and a
 * single error path so no screen can end up "broken or empty".
 */
export function useApiForm<TValues extends Record<string, unknown>>(options: UseApiFormOptions<TValues>) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<TValues>(options.initialValues ?? ({} as TValues));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const setField = useCallback(<K extends keyof TValues>(key: K, value: TValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setValues(options.initialValues ?? ({} as TValues));
    setErrors({});
    setFormError(null);
    setDone(false);
  }, [options.initialValues]);

  const submit = useCallback(
    async (overrides?: Partial<TValues>) => {
      const payload = { ...values, ...(overrides ?? {}) } as TValues;
      const localErrors = options.validate?.(payload) ?? {};
      if (Object.keys(localErrors).length) {
        setErrors(localErrors);
        setFormError('Please review the highlighted fields.');
        return { ok: false as const, error: localErrors };
      }

      setPending(true);
      setErrors({});
      setFormError(null);
      try {
        const body = options.prepare ? options.prepare(payload) : (payload as Record<string, unknown>);
        const requestOptions: RequestOptions = { method: options.method ?? 'POST', body };
        const data = await apiRequest<unknown>(options.path, requestOptions);
        setDone(true);
        if (options.success) toast.success(options.success.message, options.success.description);
        await options.onDone?.(data);
        router.refresh();
        return { ok: true as const, data };
      } catch (error) {
        if (error instanceof ApiClientError) {
          setErrors(error.fields);
          setFormError(error.message);
          if (!Object.keys(error.fields).length) toast.error('That could not be saved', error.message);
        } else {
          setFormError((error as Error)?.message ?? 'Unexpected error.');
        }
        return { ok: false as const, error: error as Error };
      } finally {
        setPending(false);
      }
    },
    [options, values, router, toast],
  );

  return { values, setValues, setField, errors, setErrors, pending, formError, done, submit, reset };
}

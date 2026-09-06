/**
 * Browser-side API client. Small on purpose: it is the only place a fetch is
 * issued from a component, so credentials, JSON headers, error shape and
 * aborting are consistent everywhere.
 */
export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  meta?: Record<string, unknown>;
  error?: { code: string; message: string; fields?: Record<string, string> };
}

export class ApiClientError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  constructor(message: string, status: number, code = 'error', fields: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined | null>;
  /** return the raw envelope instead of unwrapping data */
  raw?: boolean;
}

export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }

  const form = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const body: BodyInit | undefined = options.body === undefined ? undefined : form ? (options.body as FormData) : JSON.stringify(options.body);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      signal: options.signal,
      // A FormData body must not be given a content-type: the browser sets the boundary.
      headers: { accept: 'application/json', ...(body === undefined || form ? {} : { 'content-type': 'application/json' }) },
      body,
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') throw error;
    throw new ApiClientError('The private office could not be reached. Check your connection and try again.', 0, 'network');
  }

  const text = await response.text();
  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = text ? (JSON.parse(text) as ApiEnvelope<T>) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.ok) {
    const code = payload?.error?.code ?? (response.status === 401 ? 'unauthenticated' : 'unexpected');
    if (code === 'unauthenticated' && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    throw new ApiClientError(
      payload?.error?.message ?? `The request could not be completed (${response.status || 'network'}).`,
      response.status,
      code,
      payload?.error?.fields ?? {},
    );
  }

  if (options.raw) return payload as unknown as T;
  return payload?.data as T;
}

export const api = {
  get: <T,>(path: string, query?: RequestOptions['query']) => apiRequest<T>(path, { method: 'GET', query }),
  post: <T,>(path: string, body?: unknown, query?: RequestOptions['query']) => apiRequest<T>(path, { method: 'POST', body, query }),
  patch: <T,>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  del: <T,>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

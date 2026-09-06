/**
 * A Stripe client that needs no dependency.
 *
 * Why this file exists instead of `npm install stripe`: the platform must boot,
 * serve a household and take a membership decision on a free hosting plan with no
 * optional packages, and every previous failure mode of the integration was the
 * missing SDK (a 501 from the webhook, a build error on a dynamic import). Stripe's
 * API is ordinary HTTP with form-encoded bodies, so the honest fix is thirty lines
 * of encoding rather than a dependency that can be absent.
 *
 * Two rules carried from Stripe's own documentation, because they are where
 * hand-rolled clients usually break:
 *  • bodies are `application/x-www-form-urlencoded`, with nested objects as
 *    `a[b]` and arrays as `a[0][b]` — not JSON;
 *  • an idempotency key makes a retry safe. A household pressing « Souscrire »
 *    twice on a slow connection must not produce two customers.
 *
 * Nothing here logs a secret: the key is read per call and never returned.
 */
import { billingRuntime } from '@/lib/billing/runtime';

export class StripeError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly param?: string,
  ) {
    super(message);
    this.name = 'StripeError';
  }
}

type FormValue = string | number | boolean | null | undefined | FormValue[] | { [key: string]: FormValue };

/**
 * Stripe's bracket notation. Arrays of scalars become `key[0]`, objects become
 * `key[child]`, and a `null` is dropped rather than sent as an empty string —
 * an empty string means "clear this field" to Stripe, which is not what
 * "not set" means here.
 */
export function encodeStripeForm(params: { [key: string]: FormValue }, prefix = ''): string {
  const pairs: string[] = [];
  const push = (key: string, value: string) => pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);

  const walk = (value: FormValue, key: string) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, `${key}[${index}]`));
      return;
    }
    if (typeof value === 'object') {
      for (const [child, inner] of Object.entries(value as Record<string, FormValue>)) {
        walk(inner, `${key}[${child}]`);
      }
      return;
    }
    push(key, typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value));
  };

  for (const [key, value] of Object.entries(params)) walk(value, prefix ? `${prefix}[${key}]` : key);
  return pairs.join('&');
}

export interface StripeRequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  params?: { [key: string]: FormValue };
  /** Query string for a read. Array filters are written the way Stripe serialises them, as
   *  indexed keys — `{ 'lookup_keys[0]': 'velora-private-monthly' }`, not an array value. */
  query?: Record<string, string | number | undefined>;
  idempotencyKey?: string;
  secret?: string;
  signal?: AbortSignal;
}

/** One call to api.stripe.com (or to STRIPE_API_BASE, which is how the test suite proves this file). */
export async function stripeRequest<T = Record<string, unknown>>(path: string, options: StripeRequestOptions = {}): Promise<T> {
  const runtime = billingRuntime();
  const secret = options.secret ?? runtime.secretKey;
  if (!secret) throw new StripeError(500, 'no_secret', 'STRIPE_SECRET_KEY is not set, so no money can move.');

  const base = (runtime.apiBase || 'https://api.stripe.com').replace(/\/$/, '');
  // A call with no body is a read, whether or not the path itself carries a query:
  // `GET /v1/account`, `GET /v1/prices?lookup_keys[0]=…` and the list endpoints all
  // arrive here with `query` only. Inferring the verb from the path string alone turned
  // those into POSTs, which Stripe refuses — caught by the harness, not by a type.
  const method = options.method ?? (options.query || path.includes('?') || !Object.keys(options.params ?? {}).length ? 'GET' : 'POST');
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
    Accept: 'application/json',
    'User-Agent': 'velora-private/1.0 (billing)',
  };
  if (runtime.apiVersion) headers['Stripe-Version'] = runtime.apiVersion;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const body = method === 'GET' || method === 'DELETE' ? undefined : encodeStripeForm(options.params ?? {});
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded';

  let response: Response;
  try {
    response = await fetch(url, { method, headers, body, signal: options.signal ?? AbortSignal.timeout(15_000), cache: 'no-store' });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'network error';
    throw new StripeError(502, 'unreachable', `Stripe could not be reached (${detail}). Nothing was changed.`);
  }

  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new StripeError(response.status, 'bad_response', `Stripe answered with ${response.status} and a body that is not JSON.`);
  }

  if (!response.ok) {
    const error = (json.error ?? {}) as { message?: string; type?: string; code?: string; param?: string };
    throw new StripeError(
      response.status,
      error.code ?? error.type ?? 'stripe_error',
      error.message ?? `Stripe rejected the request with HTTP ${response.status}.`,
      error.param,
    );
  }
  return json as T;
}

/* --------------------------------------------------------- webhook trust */

export interface SignatureCheck {
  ok: boolean;
  reason: 'accepted' | 'missing_header' | 'malformed_header' | 'no_secret' | 'timestamp_too_old' | 'signature_mismatch';
  timestamp?: number;
  /** the event identifier, when the header parsed */
  eventId?: string;
}

/**
 * Verify a `Stripe-Signature` header: `t=<unix>,v1=<hex>` pairs, HMAC-SHA256 over
 * `"<t>.<raw body>"` keyed by the webhook secret (with the `whsec_` prefix removed).
 *
 * The tolerance check is not theatre: a valid signature for a body captured last
 * week is still a valid signature, so replaying it would re-run a paid event.
 */
export async function verifyStripeSignature(input: {
  raw: string;
  header: string | null;
  secret?: string;
  toleranceSeconds?: number;
  now?: number;
}): Promise<SignatureCheck> {
  const secret = (input.secret ?? billingRuntime().webhookSecret).replace(/^whsec_/, '');
  if (!secret) return { ok: false, reason: 'no_secret' };
  if (!input.header) return { ok: false, reason: 'missing_header' };

  const parts: Record<string, string[]> = {};
  for (const chunk of input.header.split(',')) {
    const [key, value] = chunk.split('=', 2);
    if (!key || value === undefined) continue;
    parts[key.trim()] = [...(parts[key.trim()] ?? []), value.trim()];
  }
  const timestamp = Number((parts.t ?? [])[0]);
  const signatures = parts.v1 ?? [];
  if (!Number.isFinite(timestamp) || !signatures.length) return { ok: false, reason: 'malformed_header' };

  const tolerance = input.toleranceSeconds ?? 300;
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestamp) > tolerance) return { ok: false, reason: 'timestamp_too_old', timestamp };

  const crypto = await import('node:crypto');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${input.raw}`).digest('hex');
  const matched = signatures.some((given) => {
    const a = Buffer.from(given, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!matched) return { ok: false, reason: 'signature_mismatch', timestamp };

  let eventId: string | undefined;
  try {
    const parsed = JSON.parse(input.raw) as { id?: string };
    if (typeof parsed.id === 'string') eventId = parsed.id;
  } catch {
    /* the body is trusted by signature; a non-JSON body would have been rejected upstream */
  }
  return { ok: true, reason: 'accepted', timestamp, eventId };
}

/** Sign like Stripe does — used by the local harness, and by nothing that ships. */
export async function signStripePayload(raw: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): Promise<string> {
  const crypto = await import('node:crypto');
  const v1 = crypto.createHmac('sha256', secret.replace(/^whsec_/, '')).update(`${timestamp}.${raw}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

/**
 * Request-level protections shared by every API route:
 *  - origin verification (CSRF, given SameSite cookies)
 *  - per-IP + per-account fixed-window rate limiting
 *  - salted, truncated IP digests for the audit trail (no raw IPs stored)
 */
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { RateLimitError } from '@/lib/http/responses';
import { OriginError } from '@/lib/errors';
import { env } from '@/lib/config';

/** Reject cross-site form posts / fetches masquerading as same-origin. */
export function assertSameOrigin(request: Request): void {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;

  const host = request.headers.get('host');
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const source = origin ?? (referer ? new URL(referer).origin : null);

  if (!source) {
    // No Origin and no Referer: a non-browser client (curl, tests). Allowed for
    // unauthenticated endpoints only when the caller supplies an explicit header.
    if (request.headers.get('x-velora-client') !== 'api') {
      throw new OriginError('A same-origin request is required. Send the Origin header, or x-velora-client: api from a server-side caller.');
    }
    return;
  }
  try {
    const url = new URL(source);
    if (url.host !== host) throw new OriginError('This request did not originate from your session.');
  } catch (error) {
    if (error instanceof OriginError) throw error;
    throw new OriginError('Malformed Origin header.');
  }
}

/* -------------------------------------------------------- rate limiting */

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-process fixed window buckets. Deliberately simple: it is enough to blunt
 * credential stuffing and prompt spam on a single node. Behind multiple
 * instances, move this to Redis by swapping `consume()`.
 */
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

export function consume(key: string, max = env.rateLimit.max, windowMs = env.rateLimit.windowMs): { remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { remaining: max - 1, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
  if (bucket.count > max) throw new RateLimitError(Math.max(1, retryAfterSeconds));
  return { remaining: max - bucket.count, retryAfterSeconds };
}

export function rateLimitByIp(request: Request, scope: string, max?: number, windowMs?: number) {
  const ip = clientIp(request);
  return consume(`${scope}:${ip}`, max, windowMs);
}

/** Auth endpoints get a much tighter budget, keyed by IP + normalised email. */
export function rateLimitAuth(request: Request, email: string, max = 8, windowMs = 5 * 60_000) {
  const ip = clientIp(request);
  return consume(`auth:${ip}:${email.toLowerCase().trim()}`, max, windowMs);
}

export function clientIp(request: Request): string {
  const h = request.headers.get('x-forwarded-for');
  if (h) return h.split(',')[0]?.trim() ?? 'unknown';
  return request.headers.get('x-real-ip') ?? 'local';
}

/** Salted + truncated so an audit row can be correlated without storing an address. */
export function hashIp(ip: string): string {
  const salt = process.env.AUDIT_IP_SALT ?? 'velora-demo-salt';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 16);
}

/* ------------------------------------------------------- input hygiene */

/** Strip control characters and cap length before anything touches SQL/HTML. */
export function sanitizeText(value: string, max = 2000): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s{3,}/g, '  ')
    .trim()
    .slice(0, max);
}

export function safeInternalPath(path: string | null | undefined, fallback = '/dashboard'): string {
  if (!path) return fallback;
  // Only accept absolute, single-slash, same-site paths: blocks open redirects.
  if (!/^\/[a-zA-Z0-9\-_/?.=&%#]*$/.test(path) || path.startsWith('//')) return fallback;
  if (path.startsWith('/api')) return fallback;
  return path;
}

export function requestHeaders() {
  return headers();
}

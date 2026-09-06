/**
 * Session tokens — signed with HS256 via `jose` so the same verification runs
 * in the Edge middleware and in Node route handlers.
 *
 * The token carries only an id, role and email claim: no personal data, no
 * database credentials, nothing that would be useful if leaked in a log.
 * Sensitive state is always re-read from the database on the server.
 */
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'velora_session';

export type Role = 'owner' | 'admin';

export interface SessionClaims {
  /** user id */
  sub: string;
  email: string;
  role: Role;
  /** issued-at seconds, returned separately for revocation checks */
  iat?: number;
}

/**
 * AUTH_SECRET is mandatory in production. The fallback below exists so the
 * demo boots on a laptop; it is a fixed, published value and the app throws
 * in production before it could ever be used there.
 */
const DEV_FALLBACK = 'velora-development-only-secret-never-use-in-production';

let cachedKey: Uint8Array | null = null;

export function signingKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const fromEnv = process.env.AUTH_SECRET;
  const material =
    fromEnv && fromEnv.length >= 32
      ? fromEnv
      : process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('AUTH_SECRET must be set in production (at least 32 characters).');
          })()
        : DEV_FALLBACK;
  cachedKey = new TextEncoder().encode(material);
  return cachedKey;
}

export function tokenTtlSeconds(): number {
  const days = Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 7);
  return Math.max(3600, Math.min(days, 30) * 24 * 3600);
}

export async function signSessionToken(claims: SessionClaims): Promise<string> {
  return new SignJWT({ email: claims.email, role: claims.role })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.sub)
    .setIssuer('velora-private')
    .setAudience('velora-private-app')
    .setIssuedAt()
    .setExpirationTime(`${tokenTtlSeconds()}s`)
    .sign(signingKey());
}

export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: 'velora-private',
      audience: 'velora-private-app',
    });
    if (!payload.sub || typeof payload.sub !== 'string') return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      role: payload.role === 'admin' ? 'admin' : 'owner',
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * CSRF posture (no token round-trip needed):
 *   1. the session cookie is SameSite=Lax  → browsers will not attach it to a
 *      cross-site POST, so a hostile form on another origin cannot act as you;
 *   2. the API layer calls `assertSameOrigin()` (src/lib/http/security.ts) on every
 *      mutating request and rejects one whose Origin/Referer host is not this host;
 *   3. no state change is ever accepted from a GET.
 */

/**
 * Session lifecycle.
 *
 * A session is a signed JWT held in an httpOnly, SameSite=Lax cookie. Nothing
 * readable by JavaScript. The user record (role, status, revocation marker) is
 * re-read from the database on every request that matters, so suspending an
 * account or rotating a password takes effect immediately even though the
 * token itself is stateless.
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb, audit, nowIso } from '@/lib/db';
import { SESSION_COOKIE, signSessionToken, verifySessionToken, type Role, type SessionClaims } from '@/lib/auth/token';
import { hashPassword } from '@/lib/auth/password';
import { fromBcp47, LOCALE_COOKIE } from '@/lib/i18n/locales';

export const APP_PATHS = {
  login: '/login',
  register: '/register',
  forgot: '/forgot-password',
  home: '/',
  app: '/dashboard',
  admin: '/admin',
} as const;

export interface SessionUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
  status: 'active' | 'invited' | 'suspended';
  country: string | null;
  timezone: string;
  locale: string;
  currency: string;
  briefingTime: string;
  notifications: Record<string, unknown>;
  avatarInitials: string | null;
  createdAt: string;
  lastLoginAt: string | null;
}

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: Math.min(Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 7), 30) * 24 * 60 * 60,
});

export async function createSession(userId: string): Promise<void> {
  const db = getDb();
  const user = db.get<Record<string, string>>(
    'SELECT id, email, role, status, locale, sessions_revoked_at FROM users WHERE id = @id',
    { id: userId },
  );
  if (!user) throw new Error('Cannot open a session for an unknown account.');
  if (user.status === 'suspended') throw new Error('This account is suspended. Contact your estate coordinator.');

  const claims = await signSessionToken({ sub: user.id, email: user.email, role: user.role as Role });
  cookies().set(SESSION_COOKIE, claims, cookieOptions());
  // The interface language the member chose in their profile is mirrored into the
  // request cookie, so signing in from a new device opens the product in their
  // language instead of the browser default. A visitor who changed the language
  // from the marketing site keeps that choice until they sign in.
  const uiLocale = fromBcp47(user.locale);
  if (uiLocale) cookies().set(LOCALE_COOKIE, uiLocale, { ...cookieOptions(), httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  db.run('UPDATE users SET last_login_at = @now, updated_at = @now WHERE id = @id', {
    now: nowIso(),
    id: userId,
  });
}

export async function destroySession(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
}

/** Claims from the cookie only (no DB) — cheap, used by middleware-adjacent code. */
export async function readSessionClaims(): Promise<SessionClaims | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * The authoritative current user.
 * Wrapped in `cache()` so a page, its layout and its API handler share one
 * database read per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const claims = await readSessionClaims();
  if (!claims) return null;
  return loadUserByClaims(claims);
});

export async function loadUserByClaims(claims: SessionClaims): Promise<SessionUser | null> {
  const db = getDb();
  const row = db.get<Record<string, string | null>>(
    `SELECT id, email, first_name, last_name, role, status, country, timezone, locale, currency,
            briefing_time, notifications_json, avatar_initials, created_at, last_login_at, sessions_revoked_at
       FROM users WHERE id = @id`,
    { id: claims.sub },
  );
  if (!row) return null;
  if (row.status === 'suspended') return null;
  // Revocation: tokens issued before a password change / "sign out everywhere" are dead.
  const revokedAt = row.sessions_revoked_at ? Date.parse(row.sessions_revoked_at) : 0;
  if (revokedAt && claims.iat && claims.iat * 1000 < revokedAt) return null;

  return {
    id: row.id as string,
    email: row.email as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    fullName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    role: (row.role as Role) ?? 'owner',
    status: (row.status as SessionUser['status']) ?? 'active',
    country: row.country ?? null,
    timezone: row.timezone ?? 'UTC',
    locale: row.locale ?? 'en-GB',
    currency: row.currency ?? 'EUR',
    briefingTime: row.briefing_time ?? '07:00',
    notifications: safeJson(row.notifications_json),
    avatarInitials: row.avatar_initials ?? null,
    createdAt: (row.created_at ?? nowIso()) as string,
    lastLoginAt: row.last_login_at ?? null,
  };
}

function safeJson(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Guard for pages: bounce signed-out visitors to the login screen. */
export async function requireUser(next: string = APP_PATHS.app): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`${APP_PATHS.login}?next=${encodeURIComponent(next)}`);
  return user;
}

/** Guard for pages that only VELORA staff may open. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser(APP_PATHS.admin);
  if (user.role !== 'admin') redirect(APP_PATHS.app);
  return user;
}

/** Guard for API handlers. Returns 401/403 shaped errors, not redirects. */
export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export async function requireApiUser(): Promise<SessionUser> {
  const claims = await readSessionClaims();
  if (!claims) throw new AuthError(401, 'A session is required to read this resource.');
  const user = await loadUserByClaims(claims);
  if (!user) throw new AuthError(401, 'This session is no longer valid. Please sign in again.');
  return user;
}

export async function requireApiAdmin(): Promise<SessionUser> {
  const user = await requireApiUser();
  if (user.role !== 'admin') throw new AuthError(403, 'Administrator access is required.');
  return user;
}

/* ------------------------------------------------------------- helpers */

/**
 * A revocation is recorded at the start of the next second: token `iat` is
 * second-granular, so stamping `now` would also invalidate a session minted in
 * the same second as a password change — which is exactly what a member does when
 * they sign in again right after changing it. Rounding up keeps every token from
 * the revocation's own second dead, and lets the next one live.
 */
export function revocationStamp(): string {
  return new Date(Math.ceil(Date.now() / 1000) * 1000).toISOString();
}

export async function revokeAllSessions(userId: string, reason: string): Promise<void> {
  const db = getDb();
  db.run('UPDATE users SET sessions_revoked_at = @now, updated_at = @now WHERE id = @id', {
    now: revocationStamp(),
    id: userId,
  });
  audit({ userId, event: 'session.revoked_all', meta: { reason } });
}

export async function setPassword(userId: string, plain: string): Promise<void> {
  const hash = await hashPassword(plain);
  const db = getDb();
  db.run('UPDATE users SET password_hash = @hash, sessions_revoked_at = @now, updated_at = @now WHERE id = @id', {
    hash,
    now: revocationStamp(),
    id: userId,
  });
  audit({ userId, event: 'account.password_changed', meta: { sessions_revoked: true } });
}

/** Used by /register and by the admin console when inviting a principal. */
export async function createUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: Role;
  country?: string | null;
  timezone?: string;
}): Promise<string> {
  const db = getDb();
  const id = `usr_${cryptoRandom()}`;
  const ts = nowIso();
  db.run(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, country,
                        timezone, locale, currency, avatar_initials, briefing_time, notifications_json, created_at, updated_at)
     VALUES (@id, @email, @hash, @first, @last, @role, 'active', @country, @tz, 'en-GB', 'EUR', @initials, '07:00', @notif, @ts, @ts)`,
    {
      id,
      email: input.email.toLowerCase(),
      hash: await hashPassword(input.password),
      first: input.firstName,
      last: input.lastName,
      role: input.role ?? 'owner',
      country: input.country ?? null,
      tz: input.timezone ?? 'Europe/Paris',
      initials: `${input.firstName[0] ?? ''}${input.lastName[0] ?? ''}`.toUpperCase(),
      notif: JSON.stringify({ daily_briefing: true, property_alerts: true, travel_updates: true, channel: 'in_app' }),
      ts,
    },
  );
  seedStarterData(id, input.firstName);
  return id;
}

/**
 * A brand-new principal must never open an empty product: give them one
 * residence, one coordinator and a starter set of tasks so every screen has a
 * realistic first state.
 */
function seedStarterData(userId: string, firstName: string) {
  const db = getDb();
  const ts = nowIso();
  const propId = `prop_${cryptoRandom()}`;
  db.run(
    `INSERT INTO properties (id, user_id, name, city, country, kind, status, is_primary, bedrooms, bathrooms,
                             area_sqm, staff_on_site, temperature_c, humidity_pct, monthly_ops_cents, accent, notes, created_at, updated_at)
     VALUES (@id, @user, 'Principal Residence', 'To be confirmed', '—', 'residence', 'attention', 1, 0, 0, 0, 0, NULL, NULL, 0, 'gold',
             'Created automatically on registration. Replace or delete this record once your residences are loaded.', @ts, @ts)`,
    { id: propId, user: userId, ts },
  );
  db.run(
    `INSERT INTO expense_categories (id, user_id, key, label, tone) VALUES
      (@c1, @user, 'property_operations', 'Property operations', 'gold'),
      (@c2, @user, 'staff', 'Staff', 'ivory'),
      (@c3, @user, 'vehicles', 'Vehicles', 'graphite'),
      (@c4, @user, 'travel', 'Travel', 'steel'),
      (@c5, @user, 'lifestyle', 'Lifestyle', 'sage'),
      (@c6, @user, 'advisers', 'Advisers & insurance', 'graphite')`,
    { c1: `cat_${cryptoRandom()}`, c2: `cat_${cryptoRandom()}`, c3: `cat_${cryptoRandom()}`, c4: `cat_${cryptoRandom()}`, c5: `cat_${cryptoRandom()}`, c6: `cat_${cryptoRandom()}`, user: userId },
  );
  db.run(
    `INSERT INTO tasks (id, user_id, property_id, title, category, status, priority, due_at, origin, requires_confirmation, detail, created_at, updated_at)
     VALUES (@id, @user, @prop, 'Confirm the residences you would like VELORA to manage', 'staff', 'pending', 'high', @due, 'system', 0, @detail, @ts, @ts)`,
    {
      id: `tsk_${cryptoRandom()}`,
      user: userId,
      prop: propId,
      due: new Date(Date.now() + 3 * 86_400_000).toISOString(),
      detail: `Welcome ${firstName}. Tell us where your residences are and who works for you; the private office loads them and the AI coordinator starts reporting on them.`,
      ts,
    },
  );
  db.run(
    `INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, amount_cents, currency, provider, current_period_end, started_at, updated_at)
     VALUES (@id, @user, 'private', 'trialing', 'monthly', 19900, 'EUR', 'demo', @end, @ts, @ts)`,
    { id: `sub_${cryptoRandom()}`, user: userId, end: new Date(Date.now() + 14 * 86_400_000).toISOString(), ts },
  );
  db.run(
    `INSERT INTO notifications (id, user_id, kind, title, body, severity, action_label, action_href, created_at)
     VALUES (@id, @user, 'system', 'Your private office is open', 'Add a residence, or ask the AI coordinator to draft your first briefing.', 'info', 'Open briefing', '/briefing', @ts)`,
    { id: `ntf_${cryptoRandom()}`, user: userId, ts },
  );
  audit({ userId, event: 'account.created', meta: { starter: true } });
}

function cryptoRandom(): string {
  // Subtle-free, dependency-free id entropy.
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 12);
}

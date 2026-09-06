/**
 * Password hashing — bcrypt, never in plain text.
 *
 * bcryptjs is pure JavaScript so it runs identically in the sandbox, in CI and
 * on a server without build tools. Swap for argon2 in a hardened deployment by
 * replacing this file only: the rest of the app talks to `hashPassword` /
 * `verifyPassword`.
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

export const PASSWORD_MIN_LENGTH = 12;

const COMMON = new Set([
  'velora2026',
  'password',
  'password1',
  'letmein',
  'welcome1',
  'qwerty123',
  'monkey123',
  'changeme',
  'iloveyou',
  'admin123',
]);

export interface PasswordCheck {
  ok: boolean;
  errors: string[];
  /** 0–4, surfaced as a discrete bar in the register form. */
  score: number;
}

export function inspectPassword(value: string): PasswordCheck {
  const errors: string[] = [];
  if (value.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  if (value.length > 200) errors.push('Use fewer than 200 characters.');
  const lower = value.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (COMMON.has(lower)) errors.push('That passphrase is on the list of known weak values.');
  if (!/[A-Z]/.test(value)) errors.push('Include one capital letter.');
  if (!/[a-z]/.test(value)) errors.push('Include one lower-case letter.');
  if (!/\d/.test(value)) errors.push('Include one number.');

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((re) => re.test(value)).length;
  const lengthScore = value.length >= 20 ? 2 : value.length >= 14 ? 1 : 0;
  const score = Math.max(0, Math.min(4, classes - 1 + lengthScore + (value.length >= 12 ? 1 : 0)));

  return { ok: errors.length === 0, errors, score };
}

function rounds(): number {
  const r = Number(process.env.BCRYPT_ROUNDS ?? 12);
  return Number.isFinite(r) && r >= 10 && r <= 15 ? r : 12;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, rounds());
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  // Constant-cost comparison even when the stored hash is malformed.
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/** Hash used for lookups that must not reveal the value (reset tokens, IPs). */
export function sha256(value: string, namespace = 'velora'): string {
  return crypto.createHmac('sha256', namespace).update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a.padEnd(64, '0').slice(0, 64), 'hex');
  const bufB = Buffer.from(b.padEnd(64, '0').slice(0, 64), 'hex');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

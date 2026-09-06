/**
 * Secrets at rest.
 *
 * The operator can connect a Stripe account from `/admin`, which means a payment
 * key ends up inside the application database instead of the host's environment.
 * That is a reasonable trade only if the file on disk is unreadable on its own:
 * a copied `velora.db`, a snapshot left by an image rebuild or a debugging dump
 * must not hand over the ability to move money.
 *
 * AES-256-GCM with a key derived from `AUTH_SECRET` by scrypt. GCM is chosen over
 * CBC for one specific reason: the authentication tag makes a tampered payload
 * fail loudly rather than decrypt into a plausible-looking wrong key, which is the
 * difference between "the connection is broken" and "we are signing requests with
 * somebody else's Stripe account".
 *
 * Dev fallback: without `AUTH_SECRET` (which `assertProductionSecret` already
 * refuses in production) a fixed development key is used and one warning is
 * printed, so the connect flow is testable without a keystore.
 */
import crypto from 'node:crypto';

const PREFIX = 'enc:v1';
let warned = false;

function derivationKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? '';
  if (secret.length >= 32) return crypto.scryptSync(secret, 'velora-settings-v1', 32);
  if (!warned) {
    warned = true;
    console.warn('[velora] AUTH_SECRET is missing or short — settings are encrypted with a development key. Never do this in production.');
  }
  return crypto.scryptSync('velora-development-only-key', 'velora-settings-v1', 32);
}

/** `enc:v1.<iv>.<tag>.<ciphertext>`, all base64url. Already-encrypted input is returned untouched. */
export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  if (plain.startsWith(`${PREFIX}.`)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivationKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [PREFIX, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

/** The plaintext, or `''` when the payload is not ours or the derivation key changed. */
export function decryptSecret(payload: string | null | undefined): string {
  if (!payload) return '';
  if (!payload.startsWith(`${PREFIX}.`)) return payload; // a value written before encryption existed
  const parts = payload.split('.');
  if (parts.length !== 4) return '';
  try {
    const [, iv, tag, data] = parts;
    const decipher = crypto.createDecipheriv('aes-256-gcm', derivationKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

/**
 * Safe to render and safe to log. The Stripe prefix is kept (test or live must stay
 * visible) and a few tail characters identify which key it is; nothing longer.
 */
export function maskSecret(value: string): string {
  if (!value) return '';
  const prefix = /^(sk|rk|pk)_(test|live)_/.exec(value)?.[0] ?? '';
  const tail = value.slice(-4);
  return `${prefix}…${tail}`;
}

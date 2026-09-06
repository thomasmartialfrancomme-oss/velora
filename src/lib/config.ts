/**
 * Server-only configuration surface. Importing this file from a Client
 * Component is a build error by construction: it reads the Node environment
 * and never re-exports secrets (only the booleans the UI needs to know).
 */
import path from 'node:path';

const isProd = process.env.NODE_ENV === 'production';

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * The signing key is resolved once, in src/lib/auth/token.ts, so that the
 * Edge middleware and the Node server always agree. In production the app
 * refuses to boot without AUTH_SECRET.
 */
export function assertProductionSecret(): void {
  if (isProd && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) {
    throw new Error(
      'AUTH_SECRET is required in production (min 32 chars). Generate one with `openssl rand -base64 48`.',
    );
  }
}

export const env = {
  appName: 'VELORA PRIVATE',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  isProduction: isProd,
  auth: {
    cookieName: 'velora_session',
    ttlDays: Number(process.env.AUTH_TOKEN_TTL_DAYS ?? 7),
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
  },
  rateLimit: {
    max: Number(process.env.RATE_LIMIT_MAX ?? 30),
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  },
  /** Capability flags — the UI reads these to stay honest about what is wired. */
  capabilities: {
    stripeConfigured: bool(process.env.STRIPE_SECRET_CONFIGURED) || Boolean(process.env.STRIPE_SECRET_KEY),
    aiProviderConfigured: Boolean(process.env.AI_PROVIDER_URL && process.env.AI_API_KEY),
    smtpConfigured: Boolean(process.env.SMTP_URL),
  },
  ai: {
    provider: process.env.AI_PROVIDER ?? 'auto',
    url: process.env.AI_PROVIDER_URL ?? '',
    key: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'velora-coordinator',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 12_000),
  },
  billing: {
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    priceIds: {
      private: process.env.STRIPE_PRICE_PRIVATE ?? '',
      priority: process.env.STRIPE_PRICE_PRIORITY ?? '',
      private_office: process.env.STRIPE_PRICE_PRIVATE_OFFICE ?? '',
    },
  },
  dbPath: process.env.VELORA_DB_PATH ?? path.join(process.cwd(), 'data', 'velora.db'),
} as const;

export type Env = typeof env;

/**
 * The billing configuration as it is *right now*, from two sources.
 *
 *  • the environment, which wins — a deployment that sets `STRIPE_SECRET_KEY` is
 *    explicit about which account it bills against, and a stale row in a database
 *    copied from another machine must never override that;
 *  • the `settings` table, which is how the operator connects their own Stripe
 *    account from `/admin` without touching a host's environment or redeploying.
 *
 * Everything reading money-related configuration goes through this file, so the
 * "which key is in force today?" question has exactly one answer. Secrets are
 * decrypted on read and never leave through a return value the browser can see
 * (`connectionSummary()` below is the shape the API returns).
 */
import { env } from '@/lib/config';
import { getDb, nowIso } from '@/lib/db';
import { decryptSecret, encryptSecret, maskSecret } from '@/lib/utils/secrets';

export const BILLING_KEYS = {
  provider: 'billing.provider',
  secretKey: 'billing.stripe_secret_key',
  webhookSecret: 'billing.stripe_webhook_secret',
  paymentMethods: 'billing.payment_methods',
  transferDueDays: 'billing.transfer_due_days',
  portalConfigurationId: 'billing.stripe_portal_configuration_id',
  accountId: 'billing.stripe_account_id',
  accountName: 'billing.stripe_account_name',
  accountCountry: 'billing.stripe_account_country',
  mode: 'billing.stripe_mode',
  connectedAt: 'billing.stripe_connected_at',
  webhookEndpointId: 'billing.stripe_webhook_endpoint_id',
  chargesEnabled: 'billing.stripe_charges_enabled',
  detailsSubmitted: 'billing.stripe_details_submitted',
  /** Lower-cased here, once: the name of the row is not a place for two call sites
   *  to agree by hand. (They did not: prices were written `…_private_monthly` and
   *  read `…_PRIVATE_MONTHLY`, and the ledger looked configured with nothing in it.) */
  price: (plan: string, cycle: string) => `settings.stripe_price_${plan.toLowerCase()}_${cycle.toLowerCase()}`,
} as const;

export interface BillingRuntime {
  secretKey: string;
  webhookSecret: string;
  paymentMethods: string;
  transferDueDays: number;
  priceIds: Record<string, string>;
  apiBase: string;
  apiVersion: string;
  configured: boolean;
  mode: 'demo' | 'test' | 'live' | 'unknown';
  /** where the working key came from, for the console and for support conversations */
  source: 'env' | 'admin' | 'none';
  account: { id: string; name: string; country: string; connectedAt: string; chargesEnabled: boolean; detailsSubmitted: boolean };
  portalConfigurationId: string;
  webhookEndpointId: string;
  hasWebhookSecret: boolean;
}

/**
 * There is deliberately no in-memory cache here.
 *
 * A production Next build instantiates this module once per route bundle, so a cache
 * would be per-bundle: the connect route would see the row it just wrote, while the
 * webhook route kept answering "no signing secret" from before the connection. That
 * is not a hypothetical — it is exactly what the harness caught: a paid event signed
 * with a secret the database plainly contained. A 19-row indexed SELECT is cheaper
 * than that class of bug, and it keeps two processes (two Render instances) honest.
 */
export function invalidateBillingRuntime(): void {
  // Kept for call sites that announce intent; nothing to invalidate.
}

function readRows(): Map<string, string> {
  const rows = new Map<string, string>();
  try {
    for (const row of getDb().all<{ key: string; value: string }>(`SELECT key, value FROM settings`)) rows.set(row.key, row.value);
  } catch {
    // A database created before the settings table existed, or a read from a context
    // with no database at all: the environment is a complete answer on its own.
  }
  return rows;
}

function modeFor(key: string, configured: boolean): BillingRuntime['mode'] {
  if (!configured) return 'demo';
  if (key.startsWith('sk_live_')) return 'live';
  if (key.startsWith('sk_test_')) return 'test';
  return 'unknown';
}

export function billingRuntime(): BillingRuntime {
  const rows = readRows();
  const stored = (key: string): string => rows.get(key) ?? '';
  const storedSecret = (key: string): string => {
    const raw = stored(key);
    return raw ? decryptSecret(raw) : '';
  };

  const envKey = env.billing.stripeSecretKey;
  const adminKey = storedSecret(BILLING_KEYS.secretKey);
  const secretKey = envKey || adminKey;
  const configured = Boolean(secretKey);

  const priceIds: Record<string, string> = { ...env.billing.priceIds };
  for (const plan of ['private', 'priority', 'private_office']) {
    for (const cycle of ['monthly', 'annual']) {
      const composite = `${plan}:${cycle}`;
      if (!priceIds[composite]) priceIds[composite] = stored(BILLING_KEYS.price(plan, cycle));
    }
  }

  const dueFromDb = Number(stored(BILLING_KEYS.transferDueDays));

  return {
    secretKey,
    webhookSecret: env.billing.stripeWebhookSecret || storedSecret(BILLING_KEYS.webhookSecret),
    // An operator who pinned the rails in the environment keeps the last word (a
    // capability the Dashboard later approves must not silently widen the checkout);
    // an untouched default must not outrank what the connection actually found.
    paymentMethods: env.billing.paymentMethodsExplicit
      ? env.billing.paymentMethods
      : stored(BILLING_KEYS.paymentMethods) || env.billing.paymentMethods,
    transferDueDays: Math.min(60, Math.max(1, dueFromDb || env.billing.transferDueDays)),
    priceIds,
    apiBase: env.billing.apiBase,
    apiVersion: env.billing.apiVersion,
    configured,
    mode: modeFor(secretKey, configured),
    source: envKey ? 'env' : adminKey ? 'admin' : 'none',
    account: {
      id: stored(BILLING_KEYS.accountId),
      name: stored(BILLING_KEYS.accountName),
      country: stored(BILLING_KEYS.accountCountry),
      connectedAt: stored(BILLING_KEYS.connectedAt),
      chargesEnabled: stored(BILLING_KEYS.chargesEnabled) === '1',
      detailsSubmitted: stored(BILLING_KEYS.detailsSubmitted) === '1',
    },
    portalConfigurationId: stored(BILLING_KEYS.portalConfigurationId),
    webhookEndpointId: stored(BILLING_KEYS.webhookEndpointId),
    hasWebhookSecret: Boolean(env.billing.stripeWebhookSecret || storedSecret(BILLING_KEYS.webhookSecret)),
  };
}

/* -------------------------------------------------------------- writing */

export function setBillingSetting(key: string, value: string | null): void {
  const db = getDb();
  if (value === null || value === '') {
    db.run(`DELETE FROM settings WHERE key = @key`, { key });
  } else {
    db.run(
      `INSERT INTO settings (key, value, updated_at) VALUES (@key, @value, @ts)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      { key, value, ts: nowIso() },
    );
  }
  invalidateBillingRuntime();
}

/** Secrets are encrypted here rather than at the call site, so none can be stored in the clear by accident. */
export function setBillingSecret(key: string, value: string | null): void {
  setBillingSetting(key, value ? encryptSecret(value) : null);
}

export function clearBillingConnection(): string[] {
  const db = getDb();
  const keys = Object.entries(BILLING_KEYS)
    .map(([, value]) => (typeof value === 'string' ? value : ''))
    .filter(Boolean);
  const placeholders = keys.map((_, index) => `@k${index}`).join(', ');
  const params: Record<string, string> = {};
  keys.forEach((key, index) => {
    params[`k${index}`] = key;
  });
  const removed = db.all<{ key: string }>(`SELECT key FROM settings WHERE key IN (${placeholders}) OR key LIKE 'settings.stripe_price_%'`, params);
  db.run(`DELETE FROM settings WHERE key IN (${placeholders}) OR key LIKE 'settings.stripe_price_%'`, params);
  invalidateBillingRuntime();
  return removed.map((row) => row.key);
}

/**
 * What the console may show. The key itself is masked, and the only booleans about
 * it are "present" and "test or live" — a browser should never receive a payment key.
 */
export function connectionSummary() {
  const runtime = billingRuntime();
  return {
    configured: runtime.configured,
    mode: runtime.mode,
    source: runtime.source,
    maskedKey: maskSecret(runtime.secretKey),
    hasWebhookSecret: runtime.hasWebhookSecret,
    paymentMethods: runtime.paymentMethods,
    transferDueDays: runtime.transferDueDays,
    portalConfigurationId: runtime.portalConfigurationId,
    webhookEndpointId: runtime.webhookEndpointId,
    account: runtime.account,
    prices: runtime.priceIds,
    pricesConfigured: Object.values(runtime.priceIds).filter(Boolean).length,
  };
}

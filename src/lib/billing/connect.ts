/**
 * Connecting an existing Stripe account from inside the product.
 *
 * The operator's request was concrete: they already have a Stripe account, they do
 * not want to read a nine-line environment recipe. So this file turns one pasted
 * secret key into a working installation, doing what `scripts/stripe-setup.mjs`
 * does — and reading what their account actually permits:
 *
 *  1. the key is checked against `GET /v1/account`, which also yields the account's
 *     name, country and which payment rails are approved. An unusable key fails
 *     here, before anything is written;
 *  2. products and prices are created **by lookup key**, so running the connect a
 *     second time finds the existing prices instead of duplicating them;
 *  3. the customer portal configuration is found or created;
 *  4. the webhook endpoint is found or created — and a freshly created endpoint
 *     answers with its signing secret, which is why this can be wired in one go.
 *     A secret of an endpoint created earlier is not readable through the API, so
 *     that case is reported rather than guessed at;
 *  5. only then is anything stored, encrypted, and the runtime cache dropped.
 *
 * Two limits are stated to the operator instead of being quietly worked around:
 * enabling a payment rail is a contract with Stripe (capabilities are requested in
 * the Dashboard and reviewed by a human — no API can accept terms for anybody), and
 * Stripe Tax/VAT is not touched.
 */
import { env } from '@/lib/config';
import { StripeError, stripeRequest } from '@/lib/billing/stripe-api';
import { nowIso } from '@/lib/db';
import { BILLING_KEYS, billingRuntime, clearBillingConnection, connectionSummary, invalidateBillingRuntime, setBillingSecret, setBillingSetting } from '@/lib/billing/runtime';

export interface StripeAccount {
  id?: string;
  object?: string;
  country?: string;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  business_profile?: { name?: string };
  settings?: { dashboard?: { display_name?: string } };
  capabilities?: Record<string, { status?: string; requirements?: { currently_due?: unknown[]; future_due?: unknown[] } }>;
}

export interface ConnectOptions {
  secretKey: string;
  /** Defaults to the plan's own currency; a euro account needs no argument. */
  currency?: string;
  /** Rails to offer. Omit to take whatever Stripe says is approved on the account. */
  paymentMethods?: string;
  webhookUrl?: string;
}

export interface ConnectResult {
  accountId: string;
  accountName: string;
  country: string;
  mode: 'test' | 'live' | 'unknown';
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  paymentMethods: string;
  railsApproved: string[];
  railsNotApproved: string[];
  prices: Record<string, string>;
  pricesCreated: number;
  pricesReused: number;
  portalConfigurationId: string;
  portalCreated: boolean;
  webhookEndpointId: string;
  webhookCreated: boolean;
  webhookSecretKnown: boolean;
  warnings: string[];
}

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
  'payment_intent.payment_failed',
];

/** Rails this product can sell with, and the capability name Stripe uses for them. */
const RAILS: { id: string; capability: string }[] = [
  { id: 'card', capability: 'card' },
  { id: 'sepa_debit', capability: 'sepa_debit_payments' },
  { id: 'us_bank_account', capability: 'us_bank_ach_debit_payments' },
  { id: 'bacs_debit', capability: 'gb_bacs_debit_payments' },
  { id: 'ideal', capability: 'ideal_payments' },
  { id: 'bancontact', capability: 'bancontact_payments' },
  { id: 'blik', capability: 'blik_payments' },
  { id: 'swish', capability: 'swish_payments' },
  { id: 'bank_transfer', capability: 'bank_transfers' },
];

/** The catalogue is the source of the amounts; a connection can therefore never invent a price. */
const PLANS: { key: string; name: string; monthly: number; discountPct: number; positioning: string }[] = [
  { key: 'private', name: 'PRIVATE', monthly: 19_900, discountPct: 10, positioning: 'A single residence, quietly organised.' },
  { key: 'priority', name: 'PRIORITY', monthly: 49_900, discountPct: 12, positioning: 'Several residences and staff, coordinated.' },
  { key: 'private_office', name: 'PRIVATE OFFICE', monthly: 150_000, discountPct: 0, positioning: 'A family office, with its own desk.' },
];

function centsFor(plan: (typeof PLANS)[number], cycle: 'monthly' | 'annual'): number {
  return cycle === 'monthly' ? plan.monthly : Math.round(plan.monthly * 12 * (1 - plan.discountPct / 100));
}

export function looksLikeStripeKey(value: string): boolean {
  return /^sk_(test|live)_[A-Za-z0-9_]{4,}$/.test(value.trim());
}

async function lookupPrice(lookupKey: string, secret: string): Promise<string> {
  try {
    const found = await stripeRequest<{ id?: string }>('/v1/prices/lookup', { secret, method: 'GET', query: { lookup_key: lookupKey } });
    return found.id ?? '';
  } catch (error) {
    if (error instanceof StripeError && (error.status === 404 || error.code === 'resource_missing')) return '';
    throw error;
  }
}

async function findProductByName(name: string, secret: string): Promise<string> {
  const list = await stripeRequest<{ data?: { id: string; name?: string }[] }>('/v1/products', { secret, method: 'GET', query: { limit: 100, active: 'true' } });
  return (list.data ?? []).find((product) => product.name === name)?.id ?? '';
}

async function findPortalConfiguration(secret: string, name: string): Promise<string> {
  try {
    const list = await stripeRequest<{ data?: { id: string; name?: string }[] }>('/v1/billing_portal/configurations', { secret, method: 'GET', query: { limit: 25 } });
    return (list.data ?? []).find((configuration) => configuration.name === name)?.id ?? '';
  } catch (error) {
    if (error instanceof StripeError && (error.status === 404 || error.status === 400)) return '';
    throw error;
  }
}

async function findWebhookEndpoint(secret: string, url: string): Promise<{ id: string; hasSecret: boolean }> {
  try {
    const list = await stripeRequest<{ data?: { id: string; url?: string; status?: string; secret?: string | null }[] }>(
      '/v1/webhook_endpoints',
      { secret, method: 'GET', query: { limit: 50 } },
    );
    const match = (list.data ?? []).find((endpoint) => endpoint.url === url && endpoint.status !== 'disabled');
    if (!match) return { id: '', hasSecret: false };
    return { id: match.id, hasSecret: Boolean(match.secret) };
  } catch (error) {
    if (error instanceof StripeError && (error.status === 404 || error.status === 400)) return { id: '', hasSecret: false };
    throw error;
  }
}

export async function connectStripeAccount(options: ConnectOptions): Promise<ConnectResult> {
  const secret = options.secretKey.trim();
  if (!looksLikeStripeKey(secret)) {
    throw new StripeError(400, 'bad_key', 'That does not look like a Stripe secret key — it should start with sk_test_ or sk_live_.');
  }
  const currency = (options.currency ?? 'eur').toLowerCase();
  const webhookUrl = options.webhookUrl ?? `${env.appUrl.replace(/\/$/, '')}/api/billing/webhook`;

  const account = await stripeRequest<StripeAccount>('/v1/account', { secret, method: 'GET' });
  if (!account.id) throw new StripeError(502, 'bad_account', 'Stripe answered without naming an account, so nothing was changed.');

  const approved = RAILS.filter((rail) => account.capabilities?.[rail.capability]?.status === 'active').map((rail) => rail.id);
  const notApproved = RAILS.filter((rail) => !approved.includes(rail.id)).map((rail) => rail.id);
  const paymentMethods = (options.paymentMethods ?? (approved.length ? approved.join(',') : 'card')).trim();

  /* prices, by lookup key so a second connection cannot duplicate a first */
  const prices: Record<string, string> = {};
  let created = 0;
  let reused = 0;
  for (const plan of PLANS) {
    let product = await findProductByName(`VELORA ${plan.name}`, secret);
    for (const cycle of ['monthly', 'annual'] as const) {
      const lookupKey = `velora-${plan.key}-${cycle}`;
      const existing = await lookupPrice(lookupKey, secret);
      if (existing) {
        prices[`${plan.key}:${cycle}`] = existing;
        reused += 1;
        continue;
      }
      if (!product) {
        product = (await stripeRequest<{ id: string }>('/v1/products', {
          secret,
          idempotencyKey: `velora-product-${plan.key}`,
          params: { name: `VELORA ${plan.name}`, description: `VELORA PRIVATE · ${plan.name}`, metadata: { veloraPlan: plan.key } },
        })).id;
      }
      const price = await stripeRequest<{ id: string }>('/v1/prices', {
        secret,
        idempotencyKey: `velora-price-${lookupKey}`,
        params: {
          product,
          currency,
          unit_amount: centsFor(plan, cycle),
          recurring: { interval: cycle === 'monthly' ? 'month' : 'year' },
          lookup_key: lookupKey,
          nickname: `VELORA ${plan.name} · ${cycle}`,
          metadata: { veloraPlan: plan.key, veloraCycle: cycle },
        },
      });
      prices[`${plan.key}:${cycle}`] = price.id;
      created += 1;
    }
  }

  /* the customer portal: a member must be able to change a card without a ticket */
  const portalName = 'VELORA membership';
  let portalConfigurationId = await findPortalConfiguration(secret, portalName);
  let portalCreated = false;
  if (!portalConfigurationId) {
    portalConfigurationId = (
      await stripeRequest<{ id: string }>('/v1/billing_portal/configurations', {
        secret,
        idempotencyKey: 'velora-portal-configuration',
        params: {
          name: portalName,
          business_profile: { url: env.appUrl },
          features: {
            invoice_history: { enabled: true },
            payment_method_update: { enabled: true },
            customer_update: { enabled: true, allowed_updates: ['name', 'address'] },
            subscription_update: {
              enabled: true,
              default_payment_method: 'available',
              after_completion: { behavior: 'return' },
            },
          },
        },
      })
    ).id;
    portalCreated = true;
  }

  /* the webhook: only a freshly created endpoint reveals its signing secret */
  const warnings: string[] = [];
  const foundEndpoint = await findWebhookEndpoint(secret, webhookUrl);
  /** A secret we already hold — from a previous connection, or from the environment —
   *  is a reason not to touch the endpoint at all. Reconnecting must not accumulate
   *  listeners: two endpoints on the same URL means every paid event arrives twice,
   *  and the second delivery is what a duplicate invoice looks like to a member. */
  const trustedAlready = connectionSummary().hasWebhookSecret;
  let webhookEndpointId = foundEndpoint.id;
  let webhookCreated = false;
  let signingSecret = '';
  if (foundEndpoint.id && (foundEndpoint.hasSecret || trustedAlready)) {
    webhookEndpointId = foundEndpoint.id;
  } else {
    if (foundEndpoint.id) {
      warnings.push(
        `An endpoint already posts to ${webhookUrl} and Stripe will not show its signing secret again, so a second one was created to obtain a secret this product can verify. Delete ${foundEndpoint.id} in the Dashboard (Developers → Webhooks) if nothing else uses it.`,
      );
    }
    const endpoint = await stripeRequest<{ id: string; secret?: string | null }>('/v1/webhook_endpoints', {
      secret,
      idempotencyKey: `velora-webhook-${webhookUrl}`,
      params: { url: webhookUrl, enabled_events: WEBHOOK_EVENTS, metadata: { velora: 'true' } },
    });
    webhookEndpointId = endpoint.id;
    webhookCreated = true;
    signingSecret = endpoint.secret ?? '';
    if (!signingSecret && !trustedAlready) {
      warnings.push('Stripe returned no signing secret, so paid confirmations cannot be trusted yet. Paste the whsec_ value from the Dashboard next to the key and connect again.');
    }
  }

  /* only now is anything written, and both keys are written encrypted */
  setBillingSecret(BILLING_KEYS.secretKey, secret);
  if (signingSecret) setBillingSecret(BILLING_KEYS.webhookSecret, signingSecret);
  setBillingSetting(BILLING_KEYS.provider, 'stripe');
  setBillingSetting(BILLING_KEYS.mode, secret.startsWith('sk_live_') ? 'live' : 'test');
  setBillingSetting(BILLING_KEYS.paymentMethods, paymentMethods);
  setBillingSetting(BILLING_KEYS.accountId, String(account.id));
  setBillingSetting(BILLING_KEYS.accountName, String(account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? account.id));
  setBillingSetting(BILLING_KEYS.accountCountry, String(account.country ?? ''));
  setBillingSetting(BILLING_KEYS.chargesEnabled, account.charges_enabled ? '1' : '0');
  setBillingSetting(BILLING_KEYS.detailsSubmitted, account.details_submitted ? '1' : '0');
  setBillingSetting(BILLING_KEYS.portalConfigurationId, portalConfigurationId);
  setBillingSetting(BILLING_KEYS.webhookEndpointId, webhookEndpointId);
  setBillingSetting(BILLING_KEYS.connectedAt, nowIso());
  for (const [composite, id] of Object.entries(prices)) {
    const [plan, cycle] = composite.split(':');
    setBillingSetting(BILLING_KEYS.price(plan!, cycle!), id);
  }
  invalidateBillingRuntime();

  if (!account.charges_enabled) {
    warnings.push('Stripe says this account cannot charge yet (details not finished). The wiring is stored, but a member will see Stripe decline the payment until your account is activated.');
  }

  return {
    accountId: String(account.id),
    accountName: String(account.business_profile?.name ?? account.settings?.dashboard?.display_name ?? account.id),
    country: String(account.country ?? ''),
    mode: secret.startsWith('sk_live_') ? 'live' : 'test',
    chargesEnabled: Boolean(account.charges_enabled),
    detailsSubmitted: Boolean(account.details_submitted),
    paymentMethods,
    railsApproved: approved,
    railsNotApproved: notApproved,
    prices,
    pricesCreated: created,
    pricesReused: reused,
    portalConfigurationId,
    portalCreated,
    webhookEndpointId,
    webhookCreated,
    webhookSecretKnown: Boolean(signingSecret || trustedAlready),
    warnings,
  };
}

/** Forget the stored connection. The webhook endpoint is removed at Stripe too, so a
 *  disconnected site cannot keep receiving and trusting events from a stale account. */
export async function disconnectStripeAccount(): Promise<{ removed: string[]; webhookRemoved: boolean; note: string }> {
  const before = connectionSummary();
  // Read the key that is in force *before* wiping it: after `clearStoredConnection()`
  // there is nothing left to authenticate the call that removes the webhook, and a
  // half-forgotten connection is worse than none — the endpoint would keep firing at
  // a site that no longer trusts its signatures.
  const secret = billingRuntime().secretKey;
  const removed = clearStoredConnection();
  let webhookRemoved = false;
  let deleteError = '';
  if (before.source === 'admin' && before.webhookEndpointId && secret) {
    try {
      await stripeRequest(`/v1/webhook_endpoints/${before.webhookEndpointId}`, { method: 'DELETE', secret });
      webhookRemoved = true;
    } catch (error) {
      // Left in place — and said out loud, with Stripe's reason: an endpoint nobody
      // deleted keeps signing events into a site that has stopped trusting them.
      deleteError = error instanceof Error ? error.message : 'unknown error';
    }
  }
  return {
    removed,
    webhookRemoved,
    note: webhookRemoved
      ? 'Connection removed and the webhook endpoint deleted at Stripe.'
      : `Connection removed locally. ${
          before.source === 'admin' && before.webhookEndpointId
            ? `Stripe still has endpoint ${before.webhookEndpointId}${deleteError ? ` (removal refused: ${deleteError})` : ''} — delete it in the Dashboard if you will not reconnect this account.`
            : 'Nothing was changed at Stripe, because the key lives in your environment; remove it there to disconnect for good.'
        }`,
  };
}

function clearStoredConnection(): string[] {
  // The list of keys this wipes lives in one place: BILLING_KEYS in runtime.ts.
  return clearBillingConnection();
}

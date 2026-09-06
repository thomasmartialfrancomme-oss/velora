/**
 * Billing abstraction.
 *
 * The product must run before a payment provider exists, so membership state
 * lives in our own database and the provider only moves money. `DemoBilling`
 * is fully functional (subscribe, change plan, cancel at period end, invoices);
 * `StripeBilling` is wired and complete, and activates the moment a secret key
 * is present in the environment. No key is shipped with this repository.
 */
import { env } from '@/lib/config';
import { getPlan, type MembershipPlan, type PlanKey } from '@/lib/utils/format';
import { getDb, newId, nowIso } from '@/lib/db';
import { ConstraintError } from '@/lib/errors';
import type { Actor } from '@/lib/ai/context';

export interface BillingIntent {
  /** where the browser goes next */
  url: string;
  provider: 'demo' | 'stripe';
  /** true when no external money movement happened (or will, without a key) */
  simulated: boolean;
  message: string;
}

export interface BillingContext {
  actor: Actor;
  email: string;
  fullName: string;
  plan: MembershipPlan;
  billingCycle: 'monthly' | 'annual';
  appUrl: string;
}

export interface BillingProvider {
  readonly id: 'demo' | 'stripe';
  readonly label: string;
  readonly configured: boolean;
  checkout(ctx: BillingContext): Promise<BillingIntent>;
  portal(ctx: { actor: Actor; email: string; appUrl: string }): Promise<BillingIntent>;
}

/* ------------------------------------------------------------- helpers */

export function amountForPlan(plan: MembershipPlan, cycle: 'monthly' | 'annual'): number {
  const monthly = plan.price_cents_monthly;
  if (cycle === 'monthly') return monthly;
  return Math.round(monthly * 12 * (1 - plan.annual_discount_pct / 100));
}

export function getBillingStatus() {
  return {
    provider: env.capabilities.stripeConfigured ? ('stripe' as const) : ('demo' as const),
    stripeConfigured: env.capabilities.stripeConfigured,
    label: env.capabilities.stripeConfigured ? 'Stripe · live keys detected' : 'Demo billing · no payment provider connected',
    note: env.capabilities.stripeConfigured
      ? 'Checkout and the customer portal redirect to Stripe. Webhook handling is at /api/billing/webhook.'
      : 'Subscriptions are recorded in the platform database. Nothing is charged. Set STRIPE_SECRET_KEY to switch on real billing.',
  };
}

/* ------------------------------------------------------------ providers */

class DemoBilling implements BillingProvider {
  readonly id = 'demo' as const;
  readonly label = 'Demo billing (no charge)';
  readonly configured = true;

  async checkout(ctx: BillingContext): Promise<BillingIntent> {
    const db = getDb();
    const amount = amountForPlan(ctx.plan, ctx.billingCycle);
    const existing = db.get<{ id: string }>(`SELECT id FROM subscriptions WHERE user_id = @userId`, { userId: ctx.actor.id });
    const periodEnd = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth() + (ctx.billingCycle === 'annual' ? 12 : 1),
        new Date().getUTCDate(),
      ),
    ).toISOString();

    if (existing) {
      db.run(
        `UPDATE subscriptions SET plan = @plan, status = 'active', billing_cycle = @cycle, amount_cents = @amount,
                currency = 'EUR', provider = 'demo', current_period_end = @end, cancel_at_period_end = 0, cancelled_at = NULL, updated_at = @ts
          WHERE user_id = @userId`,
        { plan: ctx.plan.key, cycle: ctx.billingCycle, amount, end: periodEnd, ts: nowIso(), userId: ctx.actor.id },
      );
    } else {
      db.run(
        `INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, amount_cents, currency, provider, current_period_end, started_at, updated_at)
         VALUES (@id, @userId, @plan, 'active', @cycle, @amount, 'EUR', 'demo', @end, @ts, @ts)`,
        { id: newId('sub'), userId: ctx.actor.id, plan: ctx.plan.key, cycle: ctx.billingCycle, amount, end: periodEnd, ts: nowIso() },
      );
    }

    const invoiceNumber = `VP-${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-${String(
      Math.floor(Math.random() * 900) + 100,
    )}`;
    db.run(
      `INSERT INTO invoices (id, user_id, subscription_id, number, description, amount_cents, currency, status, issued_at)
       VALUES (@id, @userId, (SELECT id FROM subscriptions WHERE user_id = @userId), @number, @description, @amount, 'EUR', 'open', @ts)`,
      {
        id: newId('inv'),
        userId: ctx.actor.id,
        number: invoiceNumber,
        description: `${ctx.plan.name} — ${ctx.billingCycle === 'annual' ? 'annual' : 'monthly'} service fee (demo, unpaid)`,
        amount,
        ts: nowIso(),
      },
    );
    db.run(`UPDATE users SET updated_at = @ts WHERE id = @userId`, { ts: nowIso(), userId: ctx.actor.id });

    return {
      url: '/membership?changed=1',
      provider: 'demo',
      simulated: true,
      message: `${ctx.plan.name} recorded on your account. No payment was taken — this build has no provider key.`,
    };
  }

  async portal(): Promise<BillingIntent> {
    return {
      url: '/membership',
      provider: 'demo',
      simulated: true,
      message: 'Manage your plan here. Card details are held by the payment provider once one is connected.',
    };
  }
}

/** The slice of the Stripe SDK this file touches — typed locally to keep the package optional. */
type StripeLike = {
  checkout: { sessions: { create(params: Record<string, unknown>): Promise<{ url?: string | null; id?: string }> } };
  billingPortal: { sessions: { create(params: Record<string, unknown>): Promise<{ url?: string | null; id?: string }> } };
  customers: { create(params: Record<string, unknown>): Promise<{ id: string }> };
  subscriptions: { cancel(id: string, params?: Record<string, unknown>): Promise<unknown> };
  webhooks: { constructEvent(rawBody: string, signature: string, secret: string): unknown };
};

/**
 * `stripe` is deliberately NOT a dependency of this project: the platform must
 * boot and serve a full household with no payment provider installed. The
 * specifier is built at runtime and marked `webpackIgnore` so the bundler never
 * tries to resolve it at build time — otherwise `next build` fails on a missing
 * module. Callers that need real Stripe get a loud, actionable error instead.
 */
export async function loadStripeConstructor(): Promise<new (secret: string, options: Record<string, unknown>) => StripeLike> {
  try {
    const specifier = 'stripe';
    const loaded = (await import(/* webpackIgnore: true */ /* @vite-ignore */ specifier)) as {
      default?: new (secret: string, options: Record<string, unknown>) => StripeLike;
    };
    const Stripe = loaded.default;
    if (typeof Stripe !== 'function') throw new Error('module has no constructor');
    return Stripe;
  } catch {
    throw new ConstraintError('Stripe keys are present but the `stripe` package is not installed. Run: npm install stripe');
  }
}

class StripeBilling implements BillingProvider {
  readonly id = 'stripe' as const;
  readonly label = 'Stripe';
  readonly configured = true;

  private async client(): Promise<StripeLike> {
    const key = env.billing.stripeSecretKey;
    if (!key) throw new ConstraintError('STRIPE_SECRET_KEY is not set.');
    const Stripe = await loadStripeConstructor();
    return new Stripe(key, { apiVersion: '2024-06-20' });
  }

  async checkout(ctx: BillingContext): Promise<BillingIntent> {
    const stripe = await this.client();
    const priceId = ctx.plan.stripe_price_env ? env.billing.priceIds[ctx.plan.key] : '';
    const lineItem = priceId
      ? { price: priceId, quantity: 1 }
      : {
          price_data: {
            currency: 'eur',
            unit_amount: amountForPlan(ctx.plan, ctx.billingCycle),
            product_data: { name: `VELORA ${ctx.plan.name}`, description: ctx.plan.positioning },
          },
          quantity: 1,
        };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: ctx.email,
      line_items: [lineItem],
      subscription_data: ctx.billingCycle === 'annual' ? { trial_period_days: 14 } : undefined,
      success_url: `${ctx.appUrl}/membership?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ctx.appUrl}/membership?status=cancelled`,
      metadata: { plan: ctx.plan.key, cycle: ctx.billingCycle, userId: ctx.actor.id },
      payment_intent_data: { description: `VELORA ${ctx.plan.name} — ${ctx.billingCycle}` },
    });
    if (!session.url) throw new ConstraintError('Stripe did not return a checkout URL.');
    return { url: session.url, provider: 'stripe', simulated: false, message: 'Redirecting to Stripe Checkout.' };
  }

  /** Used by immediate cancellation; only reachable when keys are configured. */
  async cancelNow(providerSubscriptionId: string): Promise<void> {
    const stripe = await this.client();
    await stripe.subscriptions.cancel(providerSubscriptionId, { invoice_now: true });
  }

  async portal(ctx: { actor: Actor; email: string; appUrl: string }): Promise<BillingIntent> {
    const stripe = await this.client();
    const db = getDb();
    const existing = db.get<{ provider_customer_id: string | null }>(
      `SELECT provider_customer_id FROM subscriptions WHERE user_id = @userId LIMIT 1`,
      { userId: ctx.actor.id },
    );
    let customerId = existing?.provider_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: ctx.email, metadata: { veloraUserId: ctx.actor.id } });
      customerId = customer.id;
      db.run(`UPDATE subscriptions SET provider_customer_id = @customerId, provider = 'stripe', updated_at = @ts WHERE user_id = @userId`, {
        customerId,
        ts: nowIso(),
        userId: ctx.actor.id,
      });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${ctx.appUrl}/membership`,
    });
    if (!session.url) throw new ConstraintError('Stripe did not return a portal URL.');
    return { url: session.url, provider: 'stripe', simulated: false, message: 'Opening the Stripe customer portal.' };
  }
}

export const demoBilling = new DemoBilling();
export const stripeBilling = new StripeBilling();

export function getBillingProvider(): BillingProvider {
  return env.capabilities.stripeConfigured ? stripeBilling : demoBilling;
}

/* ------------------------------------------------------------- actions */

export async function cancelSubscription(actor: Actor, atPeriodEnd = true): Promise<{ message: string; plan: PlanKey }> {
  const db = getDb();
  const subscription = db.get<{ id: string; plan: string; provider: string; provider_subscription_id: string | null }>(
    `SELECT id, plan, provider, provider_subscription_id FROM subscriptions WHERE user_id = @userId`,
    { userId: actor.id },
  );
  if (!subscription) throw new ConstraintError('There is no subscription on this account to cancel.');

  if (atPeriodEnd) {
    db.run(`UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = @ts WHERE id = @id`, { ts: nowIso(), id: subscription.id });
    return {
      message: 'Cancellation is scheduled for the end of the current period. Your records stay available until then.',
      plan: subscription.plan as PlanKey,
    };
  }

  if (subscription.provider === 'stripe' && subscription.provider_subscription_id && env.capabilities.stripeConfigured) {
    // Real cancellation at the provider, then mirrored locally.
    await new StripeBilling().cancelNow(subscription.provider_subscription_id);
  }
  db.run(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = @ts, cancel_at_period_end = 0, updated_at = @ts WHERE id = @id`, {
    ts: nowIso(),
    id: subscription.id,
  });
  return { message: 'Subscription cancelled. Access ends immediately for this demo build; a live deployment revokes at period end.', plan: subscription.plan as PlanKey };
}

export async function resumeSubscription(actor: Actor): Promise<{ message: string }> {
  const db = getDb();
  const subscription = db.get<{ id: string }>(`SELECT id FROM subscriptions WHERE user_id = @userId`, { userId: actor.id });
  if (!subscription) throw new ConstraintError('There is no subscription to resume.');
  db.run(`UPDATE subscriptions SET cancel_at_period_end = 0, status = 'active', cancelled_at = NULL, updated_at = @ts WHERE id = @id`, {
    ts: nowIso(),
    id: subscription.id,
  });
  return { message: 'Your membership continues as before.' };
}

export function planFor(key: string): MembershipPlan {
  return getPlan(key);
}

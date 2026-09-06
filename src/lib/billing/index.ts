/**
 * Billing abstraction.
 *
 * The product must run before a payment provider exists, so membership state
 * lives in our own database and the provider only moves money. `DemoBilling`
 * is fully functional (subscribe, change plan, cancel at period end, invoices);
 * `StripeBilling` is wired and complete, and activates the moment a secret key
 * is present in the environment. No key is shipped with this repository.
 */
import { billingRuntime } from '@/lib/billing/runtime';
import { intentKey, StripeError, stripeRequest, type FormValue } from '@/lib/billing/stripe-api';
import { canSellMonthly, checkoutMethodOptions, checkoutMethodTypes, methodPolicy, methodsSummary } from '@/lib/billing/methods';
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
  /**
   * The annual plan paid by transfer: an invoice with a due date, because a
   * transfer is initiated by the payer and can never be re-collected at renewal.
   */
  transferInvoice(ctx: BillingContext): Promise<BillingIntent>;
  portal(ctx: { actor: Actor; email: string; appUrl: string }): Promise<BillingIntent>;
}

/* ------------------------------------------------------------- helpers */

export function amountForPlan(plan: MembershipPlan, cycle: 'monthly' | 'annual'): number {
  const monthly = plan.price_cents_monthly;
  if (cycle === 'monthly') return monthly;
  return Math.round(monthly * 12 * (1 - plan.annual_discount_pct / 100));
}

export function getBillingStatus() {
  /** One answer for "which key is in force": the environment first, then whatever
   *  was connected from /admin. UI and money path therefore never disagree. */
  const runtime = billingRuntime();
  const configured = runtime.configured;
  const policy = methodPolicy();
  return {
    provider: configured ? ('stripe' as const) : ('demo' as const),
    stripeConfigured: configured,
    label: configured
      ? `Stripe ${runtime.mode} · ${runtime.account.name || runtime.account.id || 'account connected'}`
      : 'Demo billing · no payment provider connected',
    /** sk_test_ and sk_live_ are not decoration: a test key can never settle money. */
    mode: runtime.mode,
    /** Where the working key came from, because "which Stripe is this billing against?"
     *  is the first question in any support conversation. */
    source: runtime.source,
    account: runtime.account,
    note: configured
      ? 'Checkout, the customer portal and the invoice for a transfer all run against Stripe. Webhook handling is at /api/billing/webhook.'
      : 'Subscriptions are recorded in the platform database. Nothing is charged. Set STRIPE_SECRET_KEY, or connect an account from /admin → Facturation.',
    methods: policy.enabled.map((method) => ({ id: method.id, label: method.label, recurring: method.recurring, kind: method.kind })),
    methodsSummary: methodsSummary(policy),
    monthlyAvailable: canSellMonthly(policy),
    transferAvailable: policy.oneOff.some((method) => method.kind === 'transfer'),
    transferDueDays: runtime.transferDueDays,
    /** names in the configuration this file does not know — reported, never swallowed */
    unknownMethods: policy.unknown,
    pricesConfigured: Object.values(runtime.priceIds).filter(Boolean).length,
    /** A plan with both prices can be sold whether the ids came from the environment
     *  or from the connection made inside the product. */
    pricesComplete: ['private', 'priority', 'private_office'].every(
      (key) => Boolean(runtime.priceIds[`${key}:monthly`] && runtime.priceIds[`${key}:annual`]),
    ),
  };
}

/* ------------------------------------------------------------ providers */

/**
 * Write the mirror row for a Stripe-backed membership.
 *
 * An UPDATE alone would silently do nothing for a member who has never subscribed
 * before — which is exactly the first sale, and exactly the case where a lost
 * `provider_customer_id` means the next invoice is addressed to nobody.
 */
function upsertStripeSubscription(
  userId: string,
  fields: { plan: PlanKey; status: string; cycle: 'monthly' | 'annual'; amount: number; customer?: string | null; subscription?: string | null },
) {
  const db = getDb();
  const updated = db.run(
    `UPDATE subscriptions SET plan = @plan, status = @status, billing_cycle = @cycle, amount_cents = @amount,
            provider = 'stripe', currency = 'EUR',
            provider_customer_id = COALESCE(@customer, provider_customer_id),
            provider_subscription_id = COALESCE(@subscription, provider_subscription_id), updated_at = @ts
      WHERE user_id = @userId`,
    { ...fields, customer: fields.customer ?? null, subscription: fields.subscription ?? null, ts: nowIso(), userId },
  );
  if (updated.changes) return;
  db.run(
    `INSERT INTO subscriptions (id, user_id, plan, status, billing_cycle, amount_cents, currency, provider,
                                provider_customer_id, provider_subscription_id, started_at, updated_at)
     VALUES (@id, @userId, @plan, @status, @cycle, @amount, 'EUR', 'stripe', @customer, @subscription, @ts, @ts)`,
    {
      id: newId('sub'),
      userId,
      plan: fields.plan,
      status: fields.status,
      cycle: fields.cycle,
      amount: fields.amount,
      customer: fields.customer ?? null,
      subscription: fields.subscription ?? null,
      ts: nowIso(),
    },
  );
}


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

  /**
   * Demonstration mode writes the state a transfer would write — an `incomplete`
   * membership with one open invoice — so the screen a member reaches after paying
   * by wire is the screen you can see today. What it does not do is pretend money
   * moved: the invoice stays open.
   */
  async transferInvoice(ctx: BillingContext): Promise<BillingIntent> {
    const intent = await this.checkout({ ...ctx, billingCycle: 'annual' });
    getDb().run(`UPDATE subscriptions SET status = 'incomplete', updated_at = @ts WHERE user_id = @userId`, {
      ts: nowIso(),
      userId: ctx.actor.id,
    });
    return {
      ...intent,
      message: `An open invoice for the ${ctx.plan.name} year was recorded, marked unpaid — no payment provider is connected, so nothing was sent to a bank and nothing will be. Set STRIPE_SECRET_KEY and enable bank_transfer to receive real transfers.`,
    };
  }
}

/**
 * Real money. Built on `fetch` rather than the `stripe` package on purpose: the
 * platform must boot where optional dependencies are not installed, and a missing
 * module used to turn a valid Stripe webhook into a 501 and a build into an error.
 * `src/lib/billing/stripe-api.ts` holds the encoding and the signature scheme.
 *
 * Three rules this class never bends:
 *  • the local state is written only from Stripe's answer or its webhook, never
 *    from a browser saying "it worked";
 *  • every creation call carries an idempotency key, so a double click on a slow
 *    connection cannot open two customers;
 *  • a plan whose money has not arrived is `incomplete`, not `active`.
 */
class StripeBilling implements BillingProvider {
  readonly id = 'stripe' as const;
  readonly label = 'Stripe';
  readonly configured = true;

  private get key(): string {
    const secret = billingRuntime().secretKey;
    if (!secret) throw new ConstraintError('No Stripe secret key is in force, so no money can move. Set STRIPE_SECRET_KEY or connect an account from /admin → Facturation.');
    return secret;
  }

  /** The customer row every later call hangs off. Created once per member, then remembered. */
  private async customerId(ctx: { actor: Actor; email: string; fullName?: string }): Promise<string> {
    const db = getDb();
    const existing = db.get<{ provider_customer_id: string | null }>(
      `SELECT provider_customer_id FROM subscriptions WHERE user_id = @userId LIMIT 1`,
      { userId: ctx.actor.id },
    );
    if (existing?.provider_customer_id) return existing.provider_customer_id;

    const customerBody = {
      email: ctx.email,
      ...(ctx.fullName ? { name: ctx.fullName } : {}),
      metadata: { veloraUserId: ctx.actor.id },
    };
    const created = await stripeRequest<{ id: string }>('/v1/customers', {
      secret: this.key,
      idempotencyKey: intentKey(`velora-customer-${ctx.actor.id}`, customerBody),
      params: customerBody,
    });
    db.run(`UPDATE subscriptions SET provider_customer_id = @customerId, provider = 'stripe', updated_at = @ts WHERE user_id = @userId`, {
      customerId: created.id,
      ts: nowIso(),
      userId: ctx.actor.id,
    });
    if (!db.get<{ id: string }>(`SELECT id FROM subscriptions WHERE user_id = @userId`, { userId: ctx.actor.id })) {
      upsertStripeSubscription(ctx.actor.id, {
        plan: 'private',
        status: 'incomplete',
        cycle: 'monthly',
        amount: 0,
        customer: created.id,
      });
    }
    return created.id;
  }

  /**
   * A configured price id is used when the operator ran the setup script; without
   * one the price is carried inline, which is what makes the very first sale
   * possible before anybody has touched a dashboard.
   */
  private lineItem(plan: MembershipPlan, cycle: 'monthly' | 'annual') {
    const priceId = plan.stripe_price_env ? billingRuntime().priceIds[`${plan.key}:${cycle}`] ?? '' : '';
    if (priceId) return { price: priceId, quantity: 1 };
    return {
      price_data: {
        currency: 'eur',
        unit_amount: amountForPlan(plan, cycle),
        recurring: { interval: cycle === 'monthly' ? 'month' : 'year' },
        product_data: { name: `VELORA ${plan.name}`, description: plan.positioning },
      },
      quantity: 1,
    };
  }

  async checkout(ctx: BillingContext): Promise<BillingIntent> {
    const policy = methodPolicy();
    if (ctx.billingCycle === 'monthly' && !canSellMonthly(policy)) {
      throw new ConstraintError(
        'The monthly plan renews by itself, and none of the enabled payment methods can be re-charged. Choose the annual plan, or enable card or a direct debit.',
      );
    }
    const types = checkoutMethodTypes(policy);
    const options = checkoutMethodOptions(policy);

    const sessionBody: { [key: string]: FormValue } = {
        mode: 'subscription',
        client_reference_id: ctx.actor.id,
        customer_email: ctx.email,
        line_items: [this.lineItem(ctx.plan, ctx.billingCycle)],
        // Only the rails the operator switched on: an option Stripe has not enabled
        // on the account renders as a dead button, which reads as our bug.
        ...(types.length ? { payment_method_types: types } : {}),
        ...(options ? { payment_method_options: options } : {}),
        subscription_data: {
          ...(ctx.billingCycle === 'annual' ? { trial_period_days: 14 } : {}),
          metadata: { plan: ctx.plan.key, cycle: ctx.billingCycle, userId: ctx.actor.id },
        },
        metadata: { plan: ctx.plan.key, cycle: ctx.billingCycle, userId: ctx.actor.id },
        // Pas d'`invoice_creation` ici : ce champ n'existe que pour `mode: 'payment'`. Sur un
        // abonnement Stripe crée la facture de lui-même, et envoyer la clé fait refuser la session —
        // mesuré sur le compte réel, où le bouton « Adhérer » répondait 500.
        allow_promotion_codes: false,
        success_url: `${ctx.appUrl}/membership?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${ctx.appUrl}/membership?status=cancelled`,
      };

    // Deux cas où la clé ne peut pas être rejouée telle quelle : un Stripe qui a gardé en
    // mémoire l'ancienne tentative (jusqu'à 24 h après une mise à jour des rails ou du prix),
    // et un session rejouée qui a depuis expiré — lien mort pour le membre. Une seconde
    // tentative avec une clé neuve, pas de boucle.
    let session: { url?: string | null; id?: string; status?: string } | undefined;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // Deuxième tentative : on retire notre liste de moyens de paiement. Un compte en euros
      // refuse `us_bank_account` et `bacs_debit`, un compte en couronnes refuserait iDEAL — la
      // compatibilité dépend de la devise et du compte, pas de nous, et laisser Stripe choisir
      // ses propres méthodes éligibles vaut mieux qu'un 500 sur le bouton d'adhésion.
      const body: { [key: string]: FormValue } = {};
      if (attempt === 0) Object.assign(body, sessionBody);
      else for (const [field, value] of Object.entries(sessionBody)) if (!field.startsWith('payment_method_')) body[field] = value;
      const key = attempt === 0 ? intentKey(`velora-checkout-${ctx.actor.id}-${ctx.plan.key}-${ctx.billingCycle}`, sessionBody) : `velora-checkout-${ctx.actor.id}-${Date.now()}-retry`;
      try {
        const created = await stripeRequest<{ url?: string | null; id?: string; status?: string }>('/v1/checkout/sessions', {
          secret: this.key,
          idempotencyKey: key,
          params: body,
        });
        if (created.url && created.status !== 'expired') {
          session = created;
          break;
        }
        if (attempt === 1) {
          session = created;
          break;
        }
      } catch (err) {
        if (err instanceof StripeError && attempt === 0 && (/idempot/i.test(err.message) || /payment_method_(types|options)/.test(err.message))) continue;
        throw err;
      }
    }
    if (!session) throw new StripeError(502, 'checkout_unavailable', 'Stripe did not return a payment page. Try again in a moment.');
    if (!session.url) throw new ConstraintError('Stripe did not return a checkout URL.');
    return {
      url: session.url,
      provider: 'stripe',
      simulated: false,
      message: `Opening Stripe Checkout. You can pay by ${methodsSummary(policy)}.`,
    };
  }

  /**
   * A transfer is not a checkout: nobody is there to authorise a payment, so the
   * product opens an invoice and Stripe renders the transfer instructions on its own
   * hosted page. The subscription is created `default_incomplete`, and only the
   * `invoice.paid` webhook makes it `active` — the point of the whole arrangement.
   */
  async transferInvoice(ctx: BillingContext): Promise<BillingIntent> {
    const policy = methodPolicy();
    if (!policy.enabled.some((method) => method.kind === 'transfer')) {
      throw new ConstraintError('Bank transfer is not enabled. Add bank_transfer to VELORA_PAYMENT_METHODS (or to the rails saved when the account was connected) and switch it on in the Stripe Dashboard.');
    }
    if (ctx.billingCycle !== 'annual') {
      throw new ConstraintError(
        'A transfer is initiated by the payer, so it cannot pay a monthly renewal. The transfer option belongs to the annual plan, where one invoice covers the year.',
      );
    }

    const customer = await this.customerId(ctx);
    const types = Array.from(new Set(policy.enabled.map((method) => method.stripeType)));
    const subscription = await stripeRequest<{ latest_invoice?: string | { id?: string } | null }>('/v1/subscriptions', {
      secret: this.key,
      idempotencyKey: intentKey(`velora-transfer-${ctx.actor.id}-${ctx.plan.key}`, { customer, cycle: ctx.billingCycle }),
      params: {
        customer,
        items: [this.lineItem(ctx.plan, 'annual')],
        collection_method: 'send_invoice',
        days_until_due: billingRuntime().transferDueDays,
        payment_behavior: 'default_incomplete',
        payment_settings: {
          save_default_payment_method: 'off',
          ...(types.length ? { payment_method_types: types } : {}),
        },
        metadata: { plan: ctx.plan.key, cycle: ctx.billingCycle, userId: ctx.actor.id },
      },
    });

    const invoiceId = typeof subscription.latest_invoice === 'string' ? subscription.latest_invoice : subscription.latest_invoice?.id;
    if (!invoiceId) throw new ConstraintError('Stripe created the subscription but no invoice to pay it with.');

    const invoice = await stripeRequest<{ hosted_invoice_url?: string | null; number?: string | null }>(
      `/v1/invoices/${invoiceId}/finalize_invoice`,
      { secret: this.key, idempotencyKey: `velora-transfer-finalise-${invoiceId}`, params: { auto_advance: false } },
    );

    const amount = amountForPlan(ctx.plan, 'annual');
    upsertStripeSubscription(ctx.actor.id, { plan: ctx.plan.key, status: 'incomplete', cycle: 'annual', amount, customer, subscription: null });

    // The member's own ledger shows the open invoice while the transfer is on its way.
    // Without this row the screen says "nothing pending" about an invoice that exists.
    getDb().run(
      `INSERT INTO invoices (id, user_id, subscription_id, number, description, amount_cents, currency, status, issued_at, receipt_url)
       VALUES (@id, @userId, (SELECT id FROM subscriptions WHERE user_id = @userId), @number, @description, @amount, 'EUR', 'open', @ts, @url)`,
      {
        id: newId('inv'),
        userId: ctx.actor.id,
        number: String(invoice.number ?? invoiceId),
        description: `${ctx.plan.name} — annual service fee, awaiting transfer`,
        amount,
        ts: nowIso(),
        url: invoice.hosted_invoice_url ?? null,
      },
    );

    return {
      url: invoice.hosted_invoice_url ?? '/membership',
      provider: 'stripe',
      simulated: false,
      message: `Invoice ${invoice.number ?? invoiceId} is open. Stripe shows the account details to transfer from on its own page; your membership switches on when the payment is confirmed, never before. You have ${billingRuntime().transferDueDays} days.`,
    };
  }

  /** Immediate cancellation at the provider; only reachable with keys configured. */
  async cancelNow(providerSubscriptionId: string): Promise<void> {
    await stripeRequest(`/v1/subscriptions/${providerSubscriptionId}`, {
      secret: this.key,
      method: 'DELETE',
      params: { invoice_now: true, prorate: false },
    });
  }

  async portal(ctx: { actor: Actor; email: string; appUrl: string }): Promise<BillingIntent> {
    const customer = await this.customerId({ actor: ctx.actor, email: ctx.email });
    const session = await stripeRequest<{ url?: string | null }>('/v1/billing_portal/sessions', {
      secret: this.key,
      params: { customer, return_url: `${ctx.appUrl}/membership` },
    });
    if (!session.url) throw new ConstraintError('Stripe did not return a portal URL.');
    return { url: session.url, provider: 'stripe', simulated: false, message: 'Opening the Stripe customer portal.' };
  }
}
export const demoBilling = new DemoBilling();
export const stripeBilling = new StripeBilling();

export function getBillingProvider(): BillingProvider {
  // Not `env.capabilities`: a connection made from /admin is not visible in the
  // environment, and silently staying on the demo provider there is exactly the bug
  // an operator would report as « j'ai connecté Stripe mais rien n'est payé ».
  return billingRuntime().configured ? stripeBilling : demoBilling;
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

  if (subscription.provider === 'stripe' && subscription.provider_subscription_id && billingRuntime().configured) {
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

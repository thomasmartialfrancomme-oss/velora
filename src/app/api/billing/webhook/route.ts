/**
 * POST /api/billing/webhook — Stripe → VELORA.
 *
 * Verifies the signature with STRIPE_WEBHOOK_SECRET (raw body, no parsing
 * first), then updates only the local mirror: plan, status, period end, and an
 * invoice row for `invoice.paid`. Payment method details never touch this
 * system — Stripe holds them, which is the point of using it.
 *
 * Without a webhook secret the route refuses to act (400), because an
 * unverified "payment succeeded" event is indistinguishable from an attack.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { getDb, newId, nowIso } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!env.capabilities.stripeConfigured || !env.billing.stripeWebhookSecret) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'webhook_unconfigured',
          message:
            'No Stripe signing secret is configured, so this endpoint accepts nothing. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, then point the webhook at /api/billing/webhook.',
        },
      },
      { status: 400 },
    );
  }

  const raw = await request.text();
  const signature = request.headers.get('stripe-signature') ?? '';
  let event: {
    type: string;
    data?: { object?: Record<string, unknown> };
  };

  try {
    // @ts-expect-error – optional dependency, loaded only when keys exist.
    const { default: Stripe } = await import('stripe');
    const stripe = new Stripe(env.billing.stripeSecretKey, { apiVersion: '2024-06-20' });
    event = stripe.webhooks.constructEvent(raw, signature, env.billing.stripeWebhookSecret) as never;
  } catch (error) {
    console.error('[velora] webhook rejected', error);
    return NextResponse.json({ ok: false, error: { code: 'signature_invalid', message: 'Webhook signature could not be verified.' } }, { status: 400 });
  }

  const db = getDb();
  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const userId = metadata.userId ?? null;
  const customerId = typeof object.customer === 'string' ? object.customer : null;

  switch (event.type) {
    case 'checkout.session.completed': {
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : null;
      const plan = (metadata.plan as 'private' | 'priority' | 'private_office') ?? 'private';
      if (userId) {
        db.run(
          `UPDATE subscriptions SET plan = @plan, status = 'active', provider = 'stripe',
                  provider_customer_id = @customer, provider_subscription_id = @sub, updated_at = @ts
            WHERE user_id = @userId`,
          { plan, customer: customerId, sub: subscriptionId, ts: nowIso(), userId },
        );
      }
      break;
    }
    case 'invoice.paid': {
      const amount = Number(object.amount_paid ?? 0);
      const subscriptionId = typeof object.subscription === 'string' ? object.subscription : null;
      if (userId) {
        db.run(
          `INSERT INTO invoices (id, user_id, subscription_id, number, description, amount_cents, currency, status, issued_at, paid_at, receipt_url)
           VALUES (@id, @userId, @sub, @number, @description, @amount, @currency, 'paid', @ts, @ts, @url)`,
          {
            id: newId('inv'),
            userId,
            sub: subscriptionId,
            number: String(object.number ?? `STRIPE-${Date.now()}`),
            description: 'VELORA service fee (paid via Stripe)',
            amount,
            currency: String(object.currency ?? 'EUR').toUpperCase(),
            ts: nowIso(),
            url: (object.hosted_invoice_url as string) ?? null,
          },
        );
      }
      break;
    }
    case 'invoice.payment_failed': {
      if (userId) db.run(`UPDATE subscriptions SET status = 'past_due', updated_at = @ts WHERE user_id = @userId`, { ts: nowIso(), userId });
      break;
    }
    case 'customer.subscription.deleted': {
      if (userId) {
        db.run(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = @ts, updated_at = @ts WHERE user_id = @userId`, { ts: nowIso(), userId });
      }
      break;
    }
    case 'customer.subscription.updated': {
      const periodEnd = object.current_period_end ? new Date(Number(object.current_period_end) * 1000).toISOString() : null;
      const status = String(object.status ?? 'active');
      if (userId) {
        db.run(`UPDATE subscriptions SET status = @status, current_period_end = COALESCE(@end, current_period_end), updated_at = @ts WHERE user_id = @userId`, {
          status: status === 'active' ? 'active' : status === 'trialing' ? 'trialing' : 'past_due',
          end: periodEnd,
          ts: nowIso(),
          userId,
        });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true, received: event.type });
}

/**
 * POST /api/billing/webhook — Stripe → VELORA.
 *
 * This endpoint is the only thing that may turn a payment into a membership. The
 * browser never does: `?status=success` on the return URL is a courtesy, not a
 * record. So the rules here are strict on purpose:
 *
 *  1. no signing secret configured → nothing is accepted (400). An unverified
 *     "payment succeeded" event is indistinguishable from an attack;
 *  2. the `Stripe-Signature` header is verified against the raw body (HMAC-SHA256
 *     over `"<t>.<body>"`), with a five-minute tolerance window, so a captured
 *     request from last week cannot re-run a paid event;
 *  3. the same event id is applied once. Stripe retries for up to three days, and
 *     a member receiving the same invoice twice is a support ticket;
 *  4. state changes are written from the event object only, and a transfer-paid
 *     subscription stays `incomplete` until `invoice.paid` arrives.
 *
 * Payment instruments never enter this system — no card number, no bank details,
 * no token. The only fields read are identifiers, amounts and dates.
 */
import { NextResponse } from 'next/server';
import { env } from '@/lib/config';
import { getDb, newId, nowIso } from '@/lib/db';
import { verifyStripeSignature } from '@/lib/billing/stripe-api';

export const dynamic = 'force-dynamic';

interface StripeObject extends Record<string, unknown> {
  id?: string;
  customer?: string | Record<string, unknown> | null;
  subscription?: string | Record<string, unknown> | null;
  status?: string;
  payment_status?: string;
  number?: string;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  hosted_invoice_url?: string;
  current_period_end?: number;
  metadata?: Record<string, string>;
  lines?: { data?: Array<{ period?: { end?: number } }> };
}

const asId = (value: unknown): string | null => (typeof value === 'string' ? value : null);

export async function POST(request: Request) {
  if (!env.billing.stripeWebhookSecret) {
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
  const check = await verifyStripeSignature({ raw, header: request.headers.get('stripe-signature') });
  if (!check.ok) {
    const detail: Record<string, string> = {
      missing_header: 'The Stripe-Signature header is missing.',
      malformed_header: 'The Stripe-Signature header has no timestamp or no signature.',
      timestamp_too_old: 'The signature is older than the tolerance window — this looks like a replay.',
      signature_mismatch: 'The signature does not match the body for the configured secret.',
      no_secret: 'No signing secret is configured.',
    };
    console.warn(`[velora] webhook rejected: ${check.reason}`);
    return NextResponse.json(
      { ok: false, error: { code: 'signature_invalid', message: detail[check.reason] ?? 'Webhook signature could not be verified.' } },
      { status: 400 },
    );
  }

  let event: { id?: string; type: string; data?: { object?: StripeObject } };
  try {
    event = JSON.parse(raw) as typeof event;
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'bad_json', message: 'The signed body is not JSON.' } }, { status: 400 });
  }

  const db = getDb();
  const eventId = event.id ?? check.eventId ?? null;

  // Stripe retries a delivery for days. One application per event id, remembered in
  // the audit ledger — which is also where an operator reads what arrived.
  if (eventId) {
    const seen = db.get<{ id: string }>(
      `SELECT id FROM audit_events WHERE event = 'billing.webhook.applied' AND target = @id LIMIT 1`,
      { id: eventId },
    );
    if (seen) {
      return NextResponse.json({ ok: true, duplicate: true, received: event.type });
    }
  }

  const object = event.data?.object ?? {};
  const metadata = (object.metadata ?? {}) as Record<string, string>;
  const customerId = asId(object.customer);

  /** The member: metadata first, then the provider customer we stored at checkout. */
  const userId =
    metadata.userId ??
    (customerId
      ? (db.get<{ user_id: string }>(`SELECT user_id FROM subscriptions WHERE provider_customer_id = @customer LIMIT 1`, { customer: customerId })?.user_id ?? null)
      : null);

  const periodEnd = (value: unknown): string | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000).toISOString();
    if (Array.isArray(object.lines?.data)) {
      const last = (object.lines as { data: Array<{ period?: { end?: number } }> }).data.at(-1);
      if (last?.period?.end) return new Date(last.period.end * 1000).toISOString();
    }
    return null;
  };

  switch (event.type) {
    case 'checkout.session.completed': {
      const subscriptionId = asId(object.subscription);
      const plan = (metadata.plan as 'private' | 'priority' | 'private_office') ?? 'private';
      const paid = object.payment_status === 'paid';
      if (userId) {
        db.run(
          `UPDATE subscriptions SET plan = @plan, status = @status, provider = 'stripe',
                  provider_customer_id = COALESCE(@customer, provider_customer_id),
                  provider_subscription_id = COALESCE(@sub, provider_subscription_id), updated_at = @ts
            WHERE user_id = @userId`,
          {
            plan,
            status: paid ? 'active' : 'incomplete',
            customer: customerId,
            sub: subscriptionId,
            ts: nowIso(),
            userId,
          },
        );
        if (paid) notify(userId, 'Membership confirmed', `Your ${plan} membership is active. Stripe confirmed the payment.`, 'billing');
      }
      break;
    }

    // The transfer path: money was confirmed against an invoice — only now does the
    // membership switch on, and the invoice lands in the member's own ledger.
    case 'invoice.paid': {
      const amount = Number(object.amount_paid ?? 0);
      if (userId) {
        db.run(
          `UPDATE subscriptions SET status = 'active', provider = 'stripe', current_period_end = COALESCE(@end, current_period_end), updated_at = @ts
            WHERE user_id = @userId`,
          { end: periodEnd(object.current_period_end), ts: nowIso(), userId },
        );
        // `object.subscription` is Stripe's identifier; the invoices table points at
        // ours. Writing the provider id here used to raise a foreign-key error and
        // lose the invoice row — a paid invoice that never reaches the member's ledger.
        const local = db.get<{ id: string }>(`SELECT id FROM subscriptions WHERE user_id = @userId`, { userId });
        db.run(
          `INSERT INTO invoices (id, user_id, subscription_id, number, description, amount_cents, currency, status, issued_at, paid_at, receipt_url)
           VALUES (@id, @userId, @sub, @number, @description, @amount, @currency, 'paid', @ts, @ts, @url)`,
          {
            id: newId('inv'),
            userId,
            sub: local?.id ?? null,
            number: String(object.number ?? `STRIPE-${Date.now()}`),
            description: 'VELORA service fee — confirmed by Stripe',
            amount,
            currency: String(object.currency ?? 'EUR').toUpperCase(),
            ts: nowIso(),
            url: (object.hosted_invoice_url as string) ?? null,
          },
        );
        notify(userId, 'Payment received', `Invoice ${String(object.number ?? '')} was paid. Thank you — your membership runs to the next period.`, 'billing');
      }
      break;
    }

    case 'invoice.payment_failed': {
      if (userId) {
        db.run(`UPDATE subscriptions SET status = 'past_due', updated_at = @ts WHERE user_id = @userId`, { ts: nowIso(), userId });
        notify(userId, 'Payment could not be collected', `Stripe tried ${String(object.number ?? 'the invoice')} and it failed. Nothing has been cancelled yet — update the payment method in your membership screen.`, 'billing');
      }
      break;
    }

    case 'customer.subscription.deleted': {
      if (userId) db.run(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = @ts, updated_at = @ts WHERE user_id = @userId`, { ts: nowIso(), userId });
      break;
    }

    case 'customer.subscription.updated': {
      const status = String(object.status ?? 'active');
      if (userId) {
        db.run(
          `UPDATE subscriptions SET status = @status, current_period_end = COALESCE(@end, current_period_end), updated_at = @ts WHERE user_id = @userId`,
          {
            status: ['active', 'trialing', 'past_due', 'paused', 'cancelled', 'incomplete'].includes(status) ? status : 'active',
            end: periodEnd(object.current_period_end),
            ts: nowIso(),
            userId,
          },
        );
      }
      break;
    }

    default:
      break; // ignoring an unknown event is correct; failing it makes Stripe retry forever
  }

  if (eventId) {
    db.run(
      `INSERT INTO audit_events (id, user_id, event, target, meta, ip_hash, created_at)
       VALUES (@id, @userId, 'billing.webhook.applied', @eventId, @meta, NULL, @ts)`,
      {
        id: newId('aud'),
        userId,
        eventId,
        meta: JSON.stringify({ type: event.type, amount: object.amount_paid ?? null, invoice: object.number ?? null }),
        ts: nowIso(),
      },
    );
  }

  return NextResponse.json({ ok: true, received: event.type, applied: Boolean(userId) });
}

function notify(userId: string, title: string, body: string, kind: 'billing' | 'security') {
  try {
    getDb().run(
      `INSERT INTO notifications (id, user_id, kind, title, body, read_at, created_at)
       VALUES (@id, @userId, @kind, @title, @body, NULL, @ts)`,
      { id: newId('ntf'), userId, kind, title, body, ts: nowIso() },
    );
  } catch (error) {
    // A missing notification must never fail the delivery: the money already moved.
    console.error('[velora] could not record the billing notification', error);
  }
}

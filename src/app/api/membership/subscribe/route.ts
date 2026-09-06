/**
 * POST /api/membership/subscribe
 *
 * With STRIPE_SECRET_KEY present this returns a Checkout URL and nothing is
 * written as "paid" until the webhook says so. Without a key, DemoBilling
 * records the membership in our own database and states plainly that no charge
 * was taken — the UI shows the same distinction.
 */
import { api } from '@/lib/http/handler';
import { membershipActionSchema } from '@/lib/validation/schemas';
import { getBillingProvider, planFor } from '@/lib/billing';
import { getDb, audit, nowIso } from '@/lib/db';
import { fail } from '@/lib/http/responses';
import { env } from '@/lib/config';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'membership:subscribe',
  limit: { max: 10, windowMs: 10 * 60_000 },
  schema: membershipActionSchema,
  handler: async ({ user, body }) => {
    const payload = body as {
      plan: 'private' | 'priority' | 'private_office';
      billingCycle: 'monthly' | 'annual';
      method?: 'checkout' | 'transfer';
    };
    const plan = planFor(payload.plan);
    if (!plan) return fail(422, 'unknown_plan', 'That plan is not offered.');

    const context = {
      actor: { id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency },
      email: user.email,
      fullName: user.fullName,
      plan,
      billingCycle: payload.billingCycle ?? 'monthly',
      appUrl: env.appUrl,
    } as const;

    // A transfer is an invoice; a card is a checkout. Two different money movements,
    // and the product must not let the first one stand in for a recurring charge.
    const method = payload.method === 'transfer' ? 'transfer' : 'checkout';
    const provider = getBillingProvider();
    const intent = method === 'transfer' ? await provider.transferInvoice(context) : await provider.checkout(context);

    audit({
      userId: user.id,
      event: method === 'transfer' ? 'membership.transfer_invoice_opened' : 'membership.checkout_started',
      target: plan.key,
      meta: { provider: intent.provider, simulated: intent.simulated, cycle: context.billingCycle },
    });

    if (intent.provider === 'demo') {
      getDb().run(`UPDATE users SET updated_at = @ts WHERE id = @id`, { ts: nowIso(), id: user.id });
    }

    return {
      provider: intent.provider,
      simulated: intent.simulated,
      redirect: intent.url,
      message: intent.message,
      plan: { key: plan.key, name: plan.name, priceLabel: plan.price_label },
    };
  },
});

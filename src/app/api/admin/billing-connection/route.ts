/**
 * /api/admin/billing-connection — connect the operator's own Stripe account.
 *
 * POST   { secretKey, webhookSecret?, paymentMethods? }   wire the account up
 * GET    the connection as it stands, with the key masked
 * DELETE { confirm: 'DISCONNECT' }                        forget it again
 *
 * Nothing here returns or logs a payment key. The key goes through the request body
 * into an encrypted row and back out only as `sk_live_…4242`, because an admin page
 * that can read the secret is a page whose HTML can be cached, screenshotted or
 * forwarded by somebody support-helping-you.
 */
import { z } from 'zod';
import { api } from '@/lib/http/handler';
import { fail } from '@/lib/http/responses';
import { audit } from '@/lib/db';
import { StripeError } from '@/lib/billing/stripe-api';
import { connectStripeAccount, disconnectStripeAccount } from '@/lib/billing/connect';
import { BILLING_KEYS, connectionSummary, setBillingSecret, setBillingSetting } from '@/lib/billing/runtime';
import { getBillingStatus } from '@/lib/billing';

export const dynamic = 'force-dynamic';

const connectSchema = z.object({
  secretKey: z.string().trim().min(7).max(256, 'A Stripe secret key is far shorter than that.'),
  webhookSecret: z
    .string()
    .trim()
    .regex(/^whsec_[A-Za-z0-9_]{4,}$/, 'A webhook signing secret starts with whsec_.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  paymentMethods: z.string().trim().max(160).optional(),
  transferDueDays: z.coerce.number().int().min(1).max(60).optional(),
});

export const GET = api({
  scope: 'admin:billing-connection',
  auth: 'admin',
  handler: () => ({ connection: connectionSummary(), billing: getBillingStatus() }),
});

export const POST = api({
  scope: 'admin:billing-connect',
  auth: 'admin',
  // Deliberately tight: this endpoint makes writes against a payment provider.
  limit: { max: 5, windowMs: 10 * 60_000 },
  schema: connectSchema,
  handler: async ({ request, user, body }) => {
    const input = connectSchema.parse(body);
    try {
      const outcome = await connectStripeAccount({
        secretKey: input.secretKey,
        paymentMethods: input.paymentMethods,
      });
      if (input.webhookSecret) setBillingSecret(BILLING_KEYS.webhookSecret, input.webhookSecret);
      if (input.transferDueDays) setBillingSetting(BILLING_KEYS.transferDueDays, String(input.transferDueDays));

      audit({
        userId: user.id,
        event: 'billing.stripe_connected',
        target: outcome.accountId,
        ipHash: null,
        meta: {
          mode: outcome.mode,
          rails: outcome.paymentMethods,
          pricesCreated: outcome.pricesCreated,
          pricesReused: outcome.pricesReused,
          webhookCreated: outcome.webhookCreated,
          warnings: outcome.warnings.length,
        },
      });
      return { outcome, billing: getBillingStatus(), connection: connectionSummary(), requestOrigin: new URL(request.url).origin };
    } catch (error) {
      if (error instanceof StripeError) {
        // Stripe's own words are useful here ("Invalid API Key provided", "This account
        // cannot yet create prices") and contain no secret. Nothing else is echoed.
        audit({ userId: user.id, event: 'billing.stripe_connect_failed', meta: { code: error.code, status: error.status } });
        return fail(400, 'stripe_rejected', error.code === 'bad_key' ? error.message : `Stripe refused the request: ${error.message}`);
      }
      throw error;
    }
  },
});

export const DELETE = api({
  scope: 'admin:billing-disconnect',
  auth: 'admin',
  limit: { max: 5, windowMs: 10 * 60_000 },
  schema: z.object({ confirm: z.literal('DISCONNECT', { errorMap: () => ({ message: 'Type DISCONNECT to confirm.' }) }) }),
  handler: async ({ user }) => {
    const outcome = await disconnectStripeAccount();
    audit({ userId: user.id, event: 'billing.stripe_disconnected', meta: { removed: outcome.removed.length, webhookRemoved: outcome.webhookRemoved } });
    return { ...outcome, billing: getBillingStatus() };
  },
});

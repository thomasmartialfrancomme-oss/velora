/** POST /api/membership/portal — the payment provider's own self-service screen. */
import { api } from '@/lib/http/handler';
import { getBillingProvider } from '@/lib/billing';
import { env } from '@/lib/config';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'membership:portal',
  handler: async ({ user }) => {
    const intent = await getBillingProvider().portal({
      actor: { id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency },
      email: user.email,
      appUrl: env.appUrl,
    });
    return { provider: intent.provider, redirect: intent.url, message: intent.message, simulated: intent.simulated };
  },
});

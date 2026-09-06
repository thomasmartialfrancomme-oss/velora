/** POST /api/membership/cancel — at period end by default (records stay readable until then). */
import { api } from '@/lib/http/handler';
import { cancelSubscription } from '@/lib/billing';
import { audit } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'membership:cancel',
  limit: { max: 8, windowMs: 10 * 60_000 },
  schema: z.object({ immediate: z.boolean().optional() }),
  handler: async ({ user, body }) => {
    const immediate = Boolean((body as { immediate?: boolean }).immediate);
    const outcome = await cancelSubscription(
      { id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency },
      !immediate,
    );
    audit({ userId: user.id, event: 'membership.cancellation', meta: { immediate } });
    return outcome;
  },
});

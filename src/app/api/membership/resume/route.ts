/** POST /api/membership/resume — withdraw a scheduled cancellation. */
import { api } from '@/lib/http/handler';
import { resumeSubscription } from '@/lib/billing';
import { audit } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'membership:resume',
  handler: async ({ user }) => {
    const outcome = await resumeSubscription({ id: user.id, firstName: user.firstName, timezone: user.timezone, currency: user.currency });
    audit({ userId: user.id, event: 'membership.resumed' });
    return outcome;
  },
});

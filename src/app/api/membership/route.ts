/** GET /api/membership — current plan, invoices and the honest provider status. */
import { api } from '@/lib/http/handler';
import { getMembership } from '@/lib/data/read';
import { getBillingStatus } from '@/lib/billing';
import { getPlan } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'membership:read',
  handler: ({ user }) => {
    const state = getMembership(user.id);
    return {
      ...state,
      plan: state.subscription ? getPlan(state.subscription.plan) : null,
      billing: getBillingStatus(),
    };
  },
});

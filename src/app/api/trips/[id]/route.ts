/**
 * A single journey, including its legs.
 */
import { api } from '@/lib/http/handler';
import { deleteTrip, updateTrip } from '@/lib/data/write';
import { tripUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'trips:update',
  schema: tripUpdateSchema,
  handler: ({ user, params, body }) => updateTrip(user.id, params.id, body as never),
});

export const DELETE = api({
  scope: 'trips:delete',
  handler: ({ user, params }) => ({ deleted: (deleteTrip(user.id, params.id), true) }),
});

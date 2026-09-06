/**
 * A single reservation request.
 */
import { api } from '@/lib/http/handler';
import { z } from 'zod';
import { cancelReservation, updateReservation } from '@/lib/data/write';
import { reservationUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'reservations:update',
  schema: reservationUpdateSchema.partial().extend({ decision: z.enum(['cancel', 'update']).optional() }),
  handler: ({ user, params, body }) => {
    const payload = body as { decision?: 'cancel' | 'update' };
    if (payload.decision === 'cancel') return { status: cancelReservation(user.id, params.id).status };
    return updateReservation(user.id, params.id, payload as never);
  },
});

export const DELETE = api({
  scope: 'reservations:delete',
  handler: ({ user, params }) => ({ cancelled: (cancelReservation(user.id, params.id), true) }),
});

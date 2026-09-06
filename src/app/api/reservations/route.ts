/**
 * Lifestyle requests and reservations.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listReservations } from '@/lib/data/read';
import { createReservation } from '@/lib/data/write';
import { reservationCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'reservations:list',
  handler: ({ request, user }) =>
    listReservations(user.id, { scope: (searchParam(request, 'scope') as 'upcoming' | 'past' | 'all') ?? 'all' }),
});

export const POST = api({
  scope: 'reservations:create',
  limit: { max: 60, windowMs: 60000 },
  schema: reservationCreateSchema,
  handler: ({ user, body }) => createReservation(user.id, body as never),
});

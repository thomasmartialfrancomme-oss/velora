/**
 * Journeys.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listTrips } from '@/lib/data/read';
import { createTrip } from '@/lib/data/write';
import { tripCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'trips:list',
  handler: ({ request, user }) =>
    listTrips(user.id, { scope: (searchParam(request, 'scope') as 'upcoming' | 'past' | 'all') ?? 'all' }),
});

export const POST = api({
  scope: 'trips:create',
  limit: { max: 60, windowMs: 60000 },
  schema: tripCreateSchema,
  handler: ({ user, body }) => createTrip(user.id, body as never),
});

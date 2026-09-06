/**
 * Fleet.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api } from '@/lib/http/handler';
import { listVehicles } from '@/lib/data/read';
import { createVehicle } from '@/lib/data/write';
import { vehicleCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'vehicles:list',
  handler: ({ request, user }) =>
    listVehicles(user.id),
});

export const POST = api({
  scope: 'vehicles:create',
  limit: { max: 60, windowMs: 60000 },
  schema: vehicleCreateSchema,
  handler: ({ user, body }) => createVehicle(user.id, body as never),
});

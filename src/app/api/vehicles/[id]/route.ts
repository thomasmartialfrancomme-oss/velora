/**
 * A single vehicle.
 */
import { api } from '@/lib/http/handler';
import { deleteVehicle, updateVehicle } from '@/lib/data/write';
import { vehicleUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'vehicles:update',
  schema: vehicleUpdateSchema,
  handler: ({ user, params, body }) => updateVehicle(user.id, params.id, body as never),
});

export const DELETE = api({
  scope: 'vehicles:delete',
  handler: ({ user, params }) => ({ deleted: (deleteVehicle(user.id, params.id), true) }),
});

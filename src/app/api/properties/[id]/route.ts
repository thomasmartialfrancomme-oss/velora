/**
 * A single residence: read, update, retire.
 */
import { api } from '@/lib/http/handler';
import { NotFoundError } from '@/lib/db';
import { updateProperty, deleteProperty } from '@/lib/data/write';
import { getProperty } from '@/lib/data/read';
import { propertyUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'properties:read',
  handler: ({ user, params }) => {
    const row = getProperty(user.id, params.id);
    if (!row) throw new NotFoundError('That residence is not in your records.');
    return row;
  },
});

export const PATCH = api({
  scope: 'properties:update',
  schema: propertyUpdateSchema,
  handler: ({ user, params, body }) => updateProperty(user.id, params.id, body as never),
});

export const DELETE = api({
  scope: 'properties:delete',
  handler: ({ user, params }) => ({ retired: true, ...deleteProperty(user.id, params.id) }),
});

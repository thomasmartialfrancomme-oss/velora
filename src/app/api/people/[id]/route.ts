/**
 * A single person in the household directory.
 */
import { api } from '@/lib/http/handler';
import { deleteStaff, updateStaff } from '@/lib/data/write';
import { staffUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'people:update',
  schema: staffUpdateSchema,
  handler: ({ user, params, body }) => updateStaff(user.id, params.id, body as never),
});

export const DELETE = api({
  scope: 'people:delete',
  handler: ({ user, params }) => ({ deleted: (deleteStaff(user.id, params.id), true) }),
});

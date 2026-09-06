/**
 * Household directory — people and their assignment.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listStaff } from '@/lib/data/read';
import { createStaff } from '@/lib/data/write';
import { staffCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'people:list',
  handler: ({ request, user }) =>
    listStaff(user.id, {
      q: searchParam(request, 'q'),
      role: searchParam(request, 'role'),
      status: searchParam(request, 'status'),
      propertyId: searchParam(request, 'propertyId'),
    }),
});

export const POST = api({
  scope: 'people:create',
  limit: { max: 60, windowMs: 60000 },
  schema: staffCreateSchema,
  handler: ({ user, body }) => createStaff(user.id, body as never),
});

/**
 * Household tasks.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listTasks } from '@/lib/data/read';
import { createTask } from '@/lib/data/write';
import { taskCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'tasks:list',
  handler: ({ request, user }) =>
    listTasks(user.id, {
      status: searchParam(request, 'status'),
      propertyId: searchParam(request, 'propertyId'),
      category: searchParam(request, 'category'),
      limit: 100,
    }),
});

export const POST = api({
  scope: 'tasks:create',
  limit: { max: 60, windowMs: 60000 },
  schema: taskCreateSchema,
  handler: ({ user, body }) => createTask(user.id, body as never),
});

/**
 * A single task.
 */
import { api } from '@/lib/http/handler';
import { deleteTask, updateTask } from '@/lib/data/write';
import { taskUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'tasks:update',
  schema: taskUpdateSchema,
  handler: ({ user, params, body }) => updateTask(user.id, params.id, body as never),
});

export const DELETE = api({
  scope: 'tasks:delete',
  handler: ({ user, params }) => ({ deleted: (deleteTask(user.id, params.id), true) }),
});

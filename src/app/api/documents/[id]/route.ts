/**
 * A single document record.
 */
import { api } from '@/lib/http/handler';
import { deleteDocument, updateDocument } from '@/lib/data/write';
import { documentUpdateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'documents:update',
  schema: documentUpdateSchema,
  handler: ({ user, params, body }) => updateDocument(user.id, params.id, body as never),
});

export const DELETE = api({
  scope: 'documents:delete',
  handler: ({ user, params }) => ({ deleted: (deleteDocument(user.id, params.id), true) }),
});

/**
 * Document library index.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listDocuments } from '@/lib/data/read';
import { createDocument } from '@/lib/data/write';
import { documentCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'documents:list',
  handler: ({ request, user }) =>
    listDocuments(user.id, { q: searchParam(request, 'q'), category: searchParam(request, 'category'), status: searchParam(request, 'status') }),
});

export const POST = api({
  scope: 'documents:create',
  limit: { max: 60, windowMs: 60000 },
  schema: documentCreateSchema,
  handler: ({ user, body }) => createDocument(user.id, body as never),
});

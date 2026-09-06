/**
 * Residences — list and create.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listProperties } from '@/lib/data/read';
import { createProperty } from '@/lib/data/write';
import { getProperty } from '@/lib/data/read';
import { propertyCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'properties:list',
  handler: ({ request, user }) =>
    listProperties(user.id).filter((row) => {
      const q = searchParam(request, 'q');
      const status = searchParam(request, 'status');
      if (status && status !== 'all' && row.status !== status) return false;
      if (q) {
        const needle = q.toLowerCase();
        return [row.name, row.city, row.country].some((value) => String(value).toLowerCase().includes(needle));
      }
      return true;
    }),
});

export const POST = api({
  scope: 'properties:create',
  limit: { max: 60, windowMs: 60000 },
  schema: propertyCreateSchema,
  handler: ({ user, body }) => createProperty(user.id, body as never),
});

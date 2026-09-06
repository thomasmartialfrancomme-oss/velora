/**
 * Expenditure ledger.
 * Thin by design: origin checks, rate limiting, auth, validation and the
 * response envelope all live in `api()`; tenancy is applied in the data layer.
 */
import { api, searchParam } from '@/lib/http/handler';
import { listExpenses } from '@/lib/data/read';
import { createExpense } from '@/lib/data/write';
import { expenseCreateSchema } from '@/lib/validation/schemas';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'expenses:list',
  handler: ({ request, user }) =>
    listExpenses(user.id, {
      month: searchParam(request, 'month'),
      category: searchParam(request, 'category'),
      propertyId: searchParam(request, 'propertyId'),
      q: searchParam(request, 'q'),
    }),
});

export const POST = api({
  scope: 'expenses:create',
  limit: { max: 60, windowMs: 60000 },
  schema: expenseCreateSchema,
  handler: ({ user, body }) => createExpense(user.id, body as never),
});

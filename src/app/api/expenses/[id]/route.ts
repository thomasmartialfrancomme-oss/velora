/**
 * A single ledger entry.
 */
import { api } from '@/lib/http/handler';
import { deleteExpense, reviewExpense } from '@/lib/data/write';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const PATCH = api({
  scope: 'expenses:review',
  schema: z.object({ decision: z.enum(['approved', 'disputed', 'recorded']) }),
  handler: ({ user, params, body }) =>
    reviewExpense(user.id, params.id, (body as { decision: 'approved' | 'disputed' | 'recorded' }).decision),
});

export const DELETE = api({
  scope: 'expenses:delete',
  handler: ({ user, params }) => ({ deleted: (deleteExpense(user.id, params.id), true) }),
});

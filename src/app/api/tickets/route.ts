/** Support requests from the client to the private office. */
import { api } from '@/lib/http/handler';
import { createTicket } from '@/lib/data/write';
import { ticketSchema } from '@/lib/validation/schemas';
import { listTickets } from '@/lib/data/admin';

export const dynamic = 'force-dynamic';

export const GET = api({ scope: 'tickets:list', handler: ({ user }) => listTickets(user.id) });

export const POST = api({
  scope: 'tickets:create',
  limit: { max: 20, windowMs: 10 * 60_000 },
  schema: ticketSchema,
  handler: ({ user, body }) => createTicket(user.id, body as never),
});

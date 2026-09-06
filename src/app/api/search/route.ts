/** Global search — always filtered to the caller's own records. */
import { api, searchParam } from '@/lib/http/handler';
import { globalSearch } from '@/lib/data/analytics';

export const dynamic = 'force-dynamic';

export const GET = api({
  scope: 'search',
  limit: { max: 240, windowMs: 60_000 },
  handler: ({ request, user }) => {
    const term = searchParam(request, 'q') ?? '';
    if (term.trim().length < 2) return { term: '', hits: [] };
    return { term, hits: globalSearch(user.id, term, 8) };
  },
});

/** GET /api/admin/users — the roster behind the console. */
import { api, searchParam } from '@/lib/http/handler';
import { adminUsers } from '@/lib/data/admin';

export const dynamic = 'force-dynamic';

export const GET = api({ scope: 'admin:users', auth: 'admin', handler: ({ request }) => adminUsers(searchParam(request, 'q') ?? '') });

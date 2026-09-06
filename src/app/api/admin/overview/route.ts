/** GET /api/admin/overview — console statistics for VELORA staff. */
import { api } from '@/lib/http/handler';
import { adminStats } from '@/lib/data/admin';

export const dynamic = 'force-dynamic';

export const GET = api({ scope: 'admin:overview', auth: 'admin', handler: () => adminStats() });

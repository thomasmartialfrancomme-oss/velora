/**
 * GET /api/account/export — the whole of a client's own data as JSON.
 * Portability is a security property: leaving must never mean negotiating.
 */
import { NextResponse } from 'next/server';
import { toErrorResponse } from '@/lib/http/responses';
import { requireApiUser } from '@/lib/auth/session';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TABLES = [
  'properties',
  'staff',
  'vehicles',
  'trips',
  'trip_legs',
  'tasks',
  'expenses',
  'documents',
  'reservations',
  'ai_conversations',
  'ai_messages',
  'ai_tasks',
  'subscriptions',
  'invoices',
  'notifications',
  'tickets',
];

export async function GET() {
  try {
    const user = await requireApiUser();
    const db = getDb();
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      account: { id: user.id, email: user.email, name: user.fullName, role: user.role, timezone: user.timezone, currency: user.currency },
      note: 'Records as held by VELORA. Financial figures are bookkeeping entries, not advice.',
    };
    for (const table of TABLES) {
      payload[table] = db.all(`SELECT * FROM ${table} WHERE user_id = @userId`, { userId: user.id });
    }
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="velora-export-${user.id}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

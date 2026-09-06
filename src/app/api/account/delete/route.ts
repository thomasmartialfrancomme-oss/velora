/**
 * POST /api/account/delete — hard deletion of the caller's own records.
 * Requires the passphrase again and the exact confirmation word. Children are
 * removed first, the account row last.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toErrorResponse, fail } from '@/lib/http/responses';
import { requireApiUser } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { getDb, audit } from '@/lib/db';
import { assertSameOrigin } from '@/lib/http/security';

export const dynamic = 'force-dynamic';

const schema = z.object({ password: z.string().min(1).max(200), confirm: z.literal('DELETE MY ACCOUNT') });

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return fail(422, 'validation_failed', 'Type DELETE MY ACCOUNT and provide your passphrase to confirm.');

    const row = getDb().get<{ hash: string }>(`SELECT password_hash AS hash FROM users WHERE id = @id`, { id: user.id });
    if (!row || !(await verifyPassword(parsed.data.password, row.hash))) {
      audit({ userId: user.id, event: 'account.delete_failed' });
      return fail(403, 'password_incorrect', 'Your passphrase did not match. Nothing was deleted.');
    }

    const db = getDb();
    const childTables = [
      'properties', 'staff', 'vehicles', 'trip_legs', 'trips', 'tasks', 'expenses',
      'expense_categories', 'documents', 'reservations', 'ai_messages', 'ai_tasks',
      'ai_conversations', 'subscriptions', 'invoices', 'notifications', 'tickets', 'password_resets',
    ];
    db.transaction(() => {
      for (const table of childTables) db.run(`DELETE FROM ${table} WHERE user_id = @id`, { id: user.id });
      db.run('DELETE FROM users WHERE id = @id', { id: user.id });
    })();
    audit({ userId: null, event: 'account.deleted', target: user.id, meta: { email_domain: user.email.split('@')[1] } });

    const response = NextResponse.json({ ok: true, data: { deleted: true, redirect: '/' } });
    response.cookies.delete('velora_session');
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}

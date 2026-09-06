/** Preferences: briefing delivery, per-topic notification switches. */
import { api } from '@/lib/http/handler';
import { preferencesPatchSchema } from '@/lib/validation/schemas';
import { getDb, audit, nowIso } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = api({ scope: 'prefs:read', handler: ({ user }) => ({ preferences: user.notifications, briefingTime: user.briefingTime }) });

export const PATCH = api({
  scope: 'prefs:update',
  schema: preferencesPatchSchema,
  handler: ({ user, body }) => {
    const raw = body as Record<string, unknown>;
    const nested = (raw.preferences ?? {}) as Record<string, unknown>;
    const { preferences: _ignored, briefingTime, ...flat } = raw;

    const truthy = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';
    const patch: Record<string, unknown> = {};
    for (const key of ['daily_briefing', 'property_alerts', 'travel_updates', 'expense_review', 'staff_requests'] as const) {
      const supplied = nested[key] ?? flat[key];
      if (supplied !== undefined) patch[key] = truthy(supplied);
    }
    const channel = nested.channel ?? flat.channel;
    if (channel !== undefined) patch.channel = channel;

    const merged = { ...user.notifications, ...patch };
    const ts = nowIso();
    getDb().run(
      `UPDATE users SET notifications_json = @json, briefing_time = COALESCE(@briefing, briefing_time), updated_at = @ts WHERE id = @id`,
      { json: JSON.stringify(merged), briefing: (briefingTime as string) ?? null, ts, id: user.id },
    );
    audit({ userId: user.id, event: 'account.preferences_updated', meta: Object.keys(patch) });
    return { preferences: merged, briefingTime: (briefingTime as string) ?? user.briefingTime };
  },
});

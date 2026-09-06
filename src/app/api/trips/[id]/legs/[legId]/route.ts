/**
 * PATCH /api/trips/[id]/legs/[legId] — move one step of a journey.
 *
 * A leg status is the record of what a counterparty told us, so it is deliberately
 * narrow: pending / requested / confirmed / cancelled. Confirming a leg here does
 * not contact anyone — it records that a person has been told. That distinction is
 * shown in the interface rather than papered over by the API.
 */
import { api } from '@/lib/http/handler';
import { tripLegStatusSchema } from '@/lib/validation/schemas';
import { assertOwned, setLegStatus } from '@/lib/data/write';
import { getDb, audit, nowIso } from '@/lib/db';
import { NotFoundError } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const PATCH = api<{ id: string; legId: string }>({
  scope: 'trips:leg',
  schema: tripLegStatusSchema,
  handler: ({ user, params, body }) => {
    const leg = getDb().get<{ id: string; trip_id: string }>(`SELECT id, trip_id FROM trip_legs WHERE id = @legId`, { legId: params.legId });
    if (!leg) throw new NotFoundError('That step is not in your records.');
    assertOwned(user.id, 'trip', leg.trip_id);
    const status = (body as { status: 'confirmed' | 'pending' | 'requested' | 'cancelled' }).status;
    setLegStatus(user.id, params.legId, status);
    audit({ userId: user.id, event: 'trip.leg_updated', target: `trip:${leg.trip_id}`, meta: { legId: params.legId, status, at: nowIso() } });
    return { id: params.legId, status };
  },
});

/** A leg may also be removed when the plan changes. */
export const DELETE = api<{ id: string; legId: string }>({
  scope: 'trips:leg',
  handler: ({ user, params }) => {
    const leg = getDb().get<{ id: string; trip_id: string; label: string }>(`SELECT id, trip_id, label FROM trip_legs WHERE id = @legId`, { legId: params.legId });
    if (!leg) throw new NotFoundError('That step is not in your records.');
    assertOwned(user.id, 'trip', leg.trip_id);
    getDb().run(`DELETE FROM trip_legs WHERE id = @id`, { id: params.legId });
    audit({ userId: user.id, event: 'trip.leg_removed', target: `trip:${leg.trip_id}`, meta: { label: leg.label } });
    return { deleted: true };
  },
});

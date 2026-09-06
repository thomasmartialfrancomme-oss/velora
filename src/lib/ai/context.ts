/**
 * Context assembly — the only way a provider sees client data.
 *
 * It is built server-side from the acting user's own rows and passed in
 * explicitly. Nothing here reads cookies, so a provider can never be tricked
 * into a wider scope than the request's session.
 */
import { getDb, nowIso } from '@/lib/db';
import type { ClientContext } from '@/lib/ai/types';
import { monthRange } from '@/lib/data/read';

export interface Actor {
  id: string;
  firstName: string;
  timezone: string;
  currency: string;
}

export function buildClientContext(actor: Actor): ClientContext {
  const db = getDb();
  const userId = actor.id;
  const { start, end, label } = monthRange();

  const properties = db
    .all<{
      id: string;
      name: string;
      city: string;
      country: string;
      status: string;
      is_primary: number;
      staff_on_site: number;
      next_service_at: string | null;
      temperature_c: number | null;
      monthly_ops_cents: number;
    }>(
    `SELECT id, name, city, country, status, is_primary, staff_on_site, next_service_at, temperature_c, monthly_ops_cents
       FROM properties WHERE user_id = @userId ORDER BY is_primary DESC, name`,
    { userId },
  ).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    country: row.country,
    status: row.status,
    isPrimary: Boolean(row.is_primary),
    staffOnSite: Number(row.staff_on_site ?? 0),
    nextServiceAt: row.next_service_at,
    temperatureC: row.temperature_c === null ? null : Number(row.temperature_c),
    monthlyOpsCents: Number(row.monthly_ops_cents ?? 0),
  }));

  const staff = db
    .all<{ id: string; first_name: string; last_name: string; role: string; status: string; property_id: string | null; next_task: string | null }>(
      `SELECT id, first_name, last_name, role, status, property_id, next_task FROM staff WHERE user_id = @userId ORDER BY last_name`,
      { userId },
    )
    .map((row) => ({
      id: row.id,
      name: `${row.first_name} ${row.last_name}`.trim(),
      role: row.role,
      status: row.status,
      propertyId: row.property_id,
      nextTask: row.next_task,
    }));

  const openTasks = db
    .all<{ id: string; title: string; status: string; property_id: string | null; due_at: string | null; priority: string }>(
      `SELECT id, title, status, property_id, due_at, priority FROM tasks
        WHERE user_id = @userId AND status != 'done' ORDER BY due_at IS NULL, due_at LIMIT 40`,
      { userId },
    )
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      propertyId: row.property_id,
      dueAt: row.due_at,
      priority: row.priority,
    }));

  const trips = db
    .all<{ id: string; title: string; origin_city: string; destination_city: string; starts_at: string; status: string; pending: number | null }>(
      `SELECT t.id, t.title, t.origin_city, t.destination_city, t.starts_at, t.status,
              (SELECT COUNT(*) FROM trip_legs l WHERE l.trip_id = t.id AND l.status != 'confirmed') AS pending
         FROM trips t WHERE t.user_id = @userId AND t.starts_at >= date('now','-2 day') ORDER BY t.starts_at LIMIT 10`,
      { userId },
    )
    .map((row) => ({
      id: row.id,
      title: row.title,
      originCity: row.origin_city,
      destinationCity: row.destination_city,
      startsAt: row.starts_at,
      status: row.status,
      pendingLegs: Number(row.pending ?? 0),
    }));

  const vehicles = db
    .all<{ id: string; make: string; model: string; status: string; location: string | null; next_service_at: string | null; driver: string | null }>(
      `SELECT v.id, v.make, v.model, v.status, v.location, v.next_service_at,
              TRIM(IFNULL(s.first_name,'') || ' ' || IFNULL(s.last_name,'')) AS driver
         FROM vehicles v LEFT JOIN staff s ON s.id = v.assigned_driver_id
        WHERE v.user_id = @userId ORDER BY v.make`,
      { userId },
    )
    .map((row) => ({
      id: row.id,
      name: `${row.make} ${row.model}`,
      status: row.status,
      location: row.location,
      nextServiceAt: row.next_service_at,
      assignedDriver: row.driver || null,
    }));

  const reservations = db
    .all<{ id: string; title: string; vendor: string | null; status: string; starts_at: string | null }>(
      `SELECT id, title, vendor, status, starts_at FROM reservations WHERE user_id = @userId ORDER BY starts_at DESC LIMIT 20`,
      { userId },
    )
    .map((row) => ({ ...row, vendor: row.vendor, startsAt: row.starts_at }));

  const monthTotals = db
    .all<{ key: string; label: string | null; cents: number | null; entries: number }>(
      `SELECT e.category_key AS key, c.label AS label, SUM(e.amount_cents) AS cents, COUNT(*) AS entries
         FROM expenses e LEFT JOIN expense_categories c ON c.user_id = e.user_id AND c.key = e.category_key
        WHERE e.user_id = @userId AND e.spent_on BETWEEN @start AND @end
        GROUP BY e.category_key ORDER BY cents DESC`,
      { userId, start, end },
    )
    .map((row) => ({
      label: row.label ?? row.key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
      cents: Number(row.cents ?? 0),
      entries: Number(row.entries ?? 0),
    }));

  const documents = db
    .all<{ id: string; name: string; category: string; status: string; propertyName: string | null }>(
      `SELECT d.id, d.name, d.category, d.status, p.name AS propertyName
         FROM documents d LEFT JOIN properties p ON p.id = d.property_id
        WHERE d.user_id = @userId ORDER BY d.updated_at DESC LIMIT 40`,
      { userId },
    );

  return {
    userId,
    firstName: actor.firstName,
    timezone: actor.timezone,
    currency: actor.currency,
    generatedAt: nowIso(),
    properties,
    staff,
    openTasks,
    trips,
    vehicles,
    reservations,
    monthTotals,
    monthTotalCents: monthTotals.reduce((sum, row) => sum + row.cents, 0),
    documents,
  };
}

/** Compact, model-friendly rendering of the context (keeps tokens down). */
export function contextDigest(context: ClientContext): string {
  const money = (cents: number) => `€${Math.round(cents / 100).toLocaleString('en-GB')}`;
  return [
    `Client: ${context.firstName} (household of ${context.properties.length} residences).`,
    `Residences: ${context.properties
      .map((p) => `${p.name} — ${p.city} [${p.status}${p.isPrimary ? ', primary' : ''}${p.staffOnSite ? `, ${p.staffOnSite} staff on site` : ''}]`)
      .join('; ')}`,
    `Staff: ${context.staff.map((s) => `${s.name} (${s.role.replace(/_/g, ' ')}, ${s.status.replace(/_/g, ' ')})`).join('; ')}`,
    `Open tasks: ${context.openTasks.map((t) => `${t.title} [${t.status.replace(/_/g, ' ')}${t.dueAt ? `, due ${t.dueAt.slice(0, 10)}` : ''}]`).join('; ')}`,
    `Journeys: ${context.trips.map((t) => `${t.title} on ${t.startsAt.slice(0, 16).replace('T', ' ')} [${t.status}${t.pendingLegs ? `, ${t.pendingLegs} legs unconfirmed` : ''}]`).join('; ')}`,
    `Vehicles: ${context.vehicles.map((v) => `${v.name} (${v.status.replace(/_/g, ' ')}${v.assignedDriver ? `, driver ${v.assignedDriver}` : ''})`).join('; ')}`,
    `Reservations: ${context.reservations.map((r) => `${r.title} @ ${r.vendor ?? '—'} [${r.status}]`).join('; ')}`,
    `Ledger ${new Date().toLocaleString('en-GB', { month: 'long' })}: ${context.monthTotals.map((m) => `${m.label} ${money(m.cents)}`).join('; ')} · total ${money(
      context.monthTotalCents,
    )}`,
    `Documents: ${context.documents.slice(0, 12).map((d) => `${d.name} [${d.status}]`).join('; ')}`,
  ].join('\n');
}

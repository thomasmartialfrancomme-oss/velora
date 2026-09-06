/**
 * Derived views: dashboard, AI insights, the daily briefing and global search.
 *
 * These are computed from the client's own records at request time — no cached
 * narrative, nothing invented. The AI insight engine is rule-based by design
 * (see src/lib/ai/insights.ts) so that a recommendation can always be traced
 * back to the rows that produced it.
 */
import { getDb } from '@/lib/db';
import { EXPENSE_CATEGORY_LABELS, label } from '@/lib/utils/format';
import { listTrips, listVehicles, listTasks, monthRange, type TripWithDetail, type TaskWithDetail } from '@/lib/data/read';
import { propertiesTable, type PropertyRow, type StaffRow, type ReservationRow } from '@/lib/data/tables';

/* ----------------------------------------------------------- insights */

export interface Insight {
  id: string;
  title: string;
  detail: string;
  severity: 'info' | 'attention' | 'critical';
  module: 'property' | 'people' | 'travel' | 'lifestyle' | 'finance' | 'vehicles' | 'documents' | 'intelligence';
  actionLabel: string;
  actionHref: string;
  /** the records that triggered this — shown in the UI for traceability */
  evidence: { label: string; value: string }[];
}

export function buildInsights(userId: string): Insight[] {
  const db = getDb();
  const insights: Insight[] = [];
  const now = Date.now();
  const days = (iso: string | null) => (iso ? (Date.parse(iso) - now) / 86_400_000 : null);

  const properties = propertiesTable.list({ userId });

  // 1. Maintenance confirmation outstanding on a residence flagged for attention.
  const unconfirmed = db
    .all<{ id: string; name: string; title: string; city: string; due_at: string | null }>(
      `SELECT p.id, p.name, t.title, p.city, t.due_at
         FROM properties p JOIN tasks t ON t.property_id = p.id
        WHERE p.user_id = @userId AND t.status = 'awaiting_confirmation'
        ORDER BY t.due_at ASC`,
      { userId },
    )
    .filter((row) => /confirm/i.test(row.title));
  for (const row of unconfirmed.slice(0, 2)) {
    insights.push({
      id: `insight_confirm_${row.id}`,
      title: `Your ${row.name} record has not received its scheduled confirmation.`,
      detail: `“${row.title}” is still awaiting a reply from the supplier. Nothing has been booked or signed off on your behalf.`,
      severity: 'attention',
      module: 'property',
      actionLabel: 'Review',
      actionHref: `/properties/${row.id}`,
      evidence: [
        { label: 'Residence', value: row.name },
        { label: 'Task', value: row.title },
        { label: 'Due', value: row.due_at ? new Date(row.due_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'unscheduled' },
      ],
    });
  }

  // 2. Any record awaiting the client's own confirmation.
  const awaiting = db
    .get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM tasks WHERE user_id = @userId AND status = 'awaiting_confirmation'`,
      { userId },
    )
    ?.n ?? 0;
  if (Number(awaiting) > 0) {
    insights.push({
      id: 'insight_awaiting',
      title: `${awaiting} item${Number(awaiting) === 1 ? '' : 's'} cannot move without you.`,
      detail: 'These are held for your confirmation. VELORA does not commit to a supplier, a reservation or a payment on its own.',
      severity: 'attention',
      module: 'intelligence',
      actionLabel: 'Open command centre',
      actionHref: '/ai',
      evidence: [{ label: 'Items held', value: String(awaiting) }],
    });
  }

  // 3. Residences left open with nobody assigned.
  for (const property of properties) {
    if (property.status === 'standby') continue;
    const staffCount = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM staff WHERE property_id = @id`, { id: property.id })?.n ?? 0;
    if (Number(staffCount) === 0) {
      insights.push({
        id: `insight_staff_${property.id}`,
        title: `${property.name} has nobody in the directory.`,
        detail: 'Add the people who work there so tasks, confirmations and last-activity can be attributed.',
        severity: 'info',
        module: 'people',
        actionLabel: 'Add people',
        actionHref: `/people?propertyId=${property.id}`,
        evidence: [{ label: 'Residence', value: `${property.city}` }],
      });
    }
  }

  // 4. Vehicles: overdue service, expiring insurance.
  const vehicles = listVehicles(userId);
  for (const vehicle of vehicles) {
    const toService = days(vehicle.nextServiceAt);
    if (toService !== null && toService < 0) {
      insights.push({
        id: `insight_service_${vehicle.id}`,
        title: `${vehicle.make} ${vehicle.model} — service is ${Math.abs(Math.round(toService))} days past the recorded date.`,
        detail: `Recorded at ${vehicle.mileageKm.toLocaleString('en-GB')} km against a ${vehicle.serviceIntervalKm.toLocaleString('en-GB')} km interval.`,
        severity: 'attention',
        module: 'vehicles',
        actionLabel: 'Open fleet',
        actionHref: '/vehicles',
        evidence: [
          { label: 'Vehicle', value: `${vehicle.make} ${vehicle.model}` },
          { label: 'Location', value: vehicle.location ?? '—' },
        ],
      });
    }
    const insDays = days(vehicle.insuranceExpiresAt);
    if (insDays !== null && insDays < 30) {
      insights.push({
        id: `insight_insurance_${vehicle.id}`,
        title: `${vehicle.make} ${vehicle.model} — insurance renews in ${Math.max(0, Math.round(insDays))} days.`,
        detail: `${vehicle.insuranceProvider ?? 'The insurer'} has not been instructed. A decision from you is required before renewal.`,
        severity: insDays < 14 ? 'critical' : 'attention',
        module: 'vehicles',
        actionLabel: 'Review',
        actionHref: '/vehicles',
        evidence: [{ label: 'Provider', value: vehicle.insuranceProvider ?? '—' }],
      });
    }
  }

  // 5. Travel legs that are not confirmed.
  for (const trip of listTrips(userId, { scope: 'upcoming' }).slice(0, 3)) {
    if (trip.pendingLegs > 0) {
      insights.push({
        id: `insight_trip_${trip.id}`,
        title: `${trip.title}: ${trip.pendingLegs} leg${trip.pendingLegs === 1 ? '' : 's'} not yet confirmed.`,
        detail: 'Requests have been sent. Until a supplier answers, the leg is shown as requested — never as booked.',
        severity: 'attention',
        module: 'travel',
        actionLabel: 'Open journey',
        actionHref: `/travel?trip=${trip.id}`,
        evidence: trip.legs
          .filter((leg) => leg.status !== 'confirmed')
          .slice(0, 3)
          .map((leg) => ({ label: leg.label, value: leg.status === 'requested' ? 'Requested' : 'Pending' })),
      });
    }
  }

  // 6. Expenditure movement against the previous month.
  const range = monthRange();
  const prev = monthRange(range.previous);
  const movements = db
    .all<{ key: string; current: number | null; previous: number | null }>(
      `SELECT e.category_key AS key,
              SUM(CASE WHEN e.spent_on BETWEEN @start AND @end THEN e.amount_cents ELSE 0 END) AS current,
              SUM(CASE WHEN e.spent_on BETWEEN @prevStart AND @prevEnd THEN e.amount_cents ELSE 0 END) AS previous
         FROM expenses e WHERE e.user_id = @userId GROUP BY e.category_key`,
      { userId, start: range.start, end: range.end, prevStart: prev.start, prevEnd: prev.end },
    )
    .map((row) => ({ key: row.key, current: Number(row.current ?? 0), previous: Number(row.previous ?? 0) }));

  for (const movement of movements) {
    if (movement.previous <= 0 || movement.current <= 0) continue;
    const delta = Math.round(((movement.current - movement.previous) / movement.previous) * 100);
    if (delta >= 35) {
      const name = EXPENSE_CATEGORY_LABELS[movement.key] ?? label(movement.key, {});
      insights.push({
        id: `insight_spend_${movement.key}`,
        title: `${name} is ${delta}% above last month in your records.`,
        detail: 'Recorded expenditure only — VELORA organises the ledger and does not give financial or tax advice.',
        severity: 'info',
        module: 'finance',
        actionLabel: 'Open ledger',
        actionHref: '/finance',
        evidence: [
          { label: 'This month', value: `€${Math.round(movement.current / 100).toLocaleString('en-GB')}` },
          { label: 'Last month', value: `€${Math.round(movement.previous / 100).toLocaleString('en-GB')}` },
        ],
      });
    }
  }

  // 7. Documents about to lapse.
  const expiringDocs = db
    .get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM documents WHERE user_id = @userId AND expires_at IS NOT NULL
         AND date(expires_at) <= date('now', '+30 days') AND status != 'expired'`,
      { userId },
    )
    ?.n ?? 0;
  if (Number(expiringDocs) > 0) {
    insights.push({
      id: 'insight_documents',
      title: `${expiringDocs} document${Number(expiringDocs) === 1 ? '' : 's'} lapse within 30 days.`,
      detail: 'Policies, permits and service agreements are tracked here so nothing needs to be chased by memory.',
      severity: 'attention',
      module: 'documents',
      actionLabel: 'Open library',
      actionHref: '/documents',
      evidence: [{ label: 'In library', value: String(expiringDocs) }],
    });
  }

  // 8. Environment readings outside the household threshold.
  for (const property of properties) {
    if (property.status === 'standby') continue;
    const row = db.get<{ humidity_pct: number | null; temperature_c: number | null }>(
      `SELECT humidity_pct, temperature_c FROM properties WHERE id = @id`,
      { id: property.id },
    );
    const humidity = row?.humidity_pct;
    if (humidity !== null && humidity !== undefined && humidity >= 56) {
      insights.push({
        id: `insight_env_${property.id}`,
        title: `${property.name} is holding ${humidity}% humidity.`,
        detail: 'Above the 55% household threshold. Ventilation or a dehumidifier is worth a look before the season turns.',
        severity: 'info',
        module: 'property',
        actionLabel: 'Open residence',
        actionHref: `/properties/${property.id}`,
        evidence: [
          { label: 'Temperature', value: row?.temperature_c !== null && row?.temperature_c !== undefined ? `${row.temperature_c}°C` : '—' },
          { label: 'Humidity', value: `${humidity}%` },
        ],
      });
    }
  }

  // 9. Reservations the venue has not answered.
  const unanswered = db
    .all<{ title: string; vendor: string | null }>(
      `SELECT title, vendor FROM reservations WHERE user_id = @userId AND status = 'requested' ORDER BY starts_at ASC LIMIT 1`,
      { userId },
    )
    .slice(0, 1);
  for (const reservation of unanswered) {
    insights.push({
      id: `insight_reservation_${reservation.title}`,
      title: `${reservation.vendor ?? 'The venue'} has not answered your request.`,
      detail: `“${reservation.title}” is recorded as requested. No table is held until they confirm.`,
      severity: 'info',
      module: 'lifestyle',
      actionLabel: 'Open lifestyle',
      actionHref: '/lifestyle',
      evidence: [{ label: 'Request', value: reservation.title }],
    });
  }

  const rank = { critical: 0, attention: 1, info: 2 } as const;
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6);
}

/* --------------------------------------------------------- dashboard */

export interface TodayItem {
  key: string;
  label: string;
  value: string;
  detail?: string;
  href: string;
  tone: 'default' | 'gold' | 'attention';
}

export interface DashboardData {
  firstName: string;
  today: TodayItem[];
  insights: Insight[];
  tasks: TaskWithDetail[];
  nextTrip: TripWithDetail | null;
  residences: PropertyRow[];
  staffOnSite: { name: string; role: string; city: string | null }[];
  monthSpendCents: number;
  monthLabel: string;
  previousSpendCents: number;
  counts: { residences: number; people: number; openTasks: number; pendingActions: number; vehicles: number };
}

export function getDashboardData(user: { id: string; firstName: string; currency: string }): DashboardData {
  const db = getDb();
  const userId = user.id;
  const range = monthRange();
  const prevRange = monthRange(range.previous);

  const residences = propertiesTable.list({ userId });
  const tasks = listTasks(userId, { limit: 6 });
  const upcoming = listTrips(userId, { scope: 'upcoming' });
  const nextTrip = upcoming.find((trip) => trip.status !== 'completed' && trip.status !== 'cancelled') ?? upcoming[0] ?? null;
  const insights = buildInsights(userId);

  const totalSpend = (start: string, end: string) =>
    Number(
      db.get<{ n: number | null }>(`SELECT SUM(amount_cents) AS n FROM expenses WHERE user_id = @userId AND spent_on BETWEEN @start AND @end`, {
        userId,
        start,
        end,
      })?.n ?? 0,
    );

  const monthSpendCents = totalSpend(range.start, range.end);
  const previousSpendCents = totalSpend(prevRange.start, prevRange.end);

  const staffOnSite = db
    .all<{ name: string; role: string; city: string | null }>(
      `SELECT TRIM(s.first_name || ' ' || s.last_name) AS name, s.role AS role, p.city AS city
         FROM staff s LEFT JOIN properties p ON p.id = s.property_id
        WHERE s.user_id = @userId AND s.status = 'on_site'
        ORDER BY s.last_name LIMIT 5`,
      { userId },
    );

  const counts = {
    residences: residences.length,
    people: Number(db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM staff WHERE user_id = @userId`, { userId })?.n ?? 0),
    openTasks: Number(
      db.get<{ n: number }>(
        `SELECT COUNT(*) AS n FROM tasks WHERE user_id = @userId AND status IN ('pending','in_progress','awaiting_confirmation','blocked')`,
        { userId },
      )?.n ?? 0,
    ),
    pendingActions: Number(
      db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ai_tasks WHERE user_id = @userId AND status IN ('proposed','requires_confirmation')`, { userId })?.n ?? 0,
    ),
    vehicles: Number(db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM vehicles WHERE user_id = @userId`, { userId })?.n ?? 0),
  };

  const today = new Date().toISOString().slice(0, 10);
  const arrivalLeg = nextTrip?.legs.find((leg) => leg.kind === 'arrival' || leg.kind === 'transfer');
  const todayItems: TodayItem[] = [
    {
      key: 'arrival',
      label: 'Arrival',
      value: nextTrip ? `${nextTrip.destinationCity} — ${formatTimeSafe(arrivalLeg?.at ?? nextTrip.startsAt)}` : 'Nothing scheduled',
      detail: nextTrip ? nextTrip.title : 'No arrivals recorded today',
      href: '/travel',
      tone: nextTrip ? 'gold' : 'default',
    },
    {
      key: 'property',
      label: 'Property',
      value: focusResidence(residences)?.name ?? 'No residence on file',
      detail: focusResidence(residences) ? `${focusResidence(residences)!.status === 'operational' ? 'Operational' : label(focusResidence(residences)!.status, {})}` : 'Add one to begin',
      href: '/properties',
      tone: focusResidence(residences) && focusResidence(residences)!.status !== 'operational' ? 'attention' : 'default',
    },
    {
      key: 'staff',
      label: 'Staff',
      value: `${db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM staff WHERE user_id = @userId AND status = 'on_site'`, { userId })?.n ?? 0} on site`,
      detail: staffOnSite.length ? `${staffOnSite.map((s) => s.name.split(' ').pop()).join(' · ')}` : 'No staff marked on site',
      href: '/people',
      tone: 'default',
    },
    {
      key: 'travel',
      label: 'Travel',
      value: nextTrip ? `${nextTrip.originCity} → ${nextTrip.destinationCity}` : 'No movement',
      detail: nextTrip ? `${new Date(nextTrip.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · ${label(nextTrip.status, {})}` : 'Nothing in the diary',
      href: '/travel',
      tone: nextTrip && nextTrip.status === 'pending' ? 'attention' : 'default',
    },
    {
      key: 'finance',
      label: 'Finance',
      value: `€${Math.round(monthSpendCents / 100).toLocaleString('en-GB')}`,
      detail: `recorded this month · ${db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM expenses WHERE user_id = @userId AND spent_on = @today`, { userId, today })?.n ?? 0} entries today`,
      href: '/finance',
      tone: 'default',
    },
  ];

  return {
    firstName: user.firstName,
    today: todayItems,
    insights,
    tasks,
    nextTrip,
    residences,
    staffOnSite: staffOnSite.map((s) => ({ ...s, role: label(s.role, {}) })),
    monthSpendCents,
    monthLabel: range.label,
    previousSpendCents,
    counts,
  };
}

function focusResidence(properties: PropertyRow[]): PropertyRow | undefined {
  return properties.find((p) => p.status === 'attention' || p.status === 'maintenance') ?? properties.find((p) => p.isPrimary) ?? properties[0];
}

function formatTimeSafe(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })}`;
}

/* -------------------------------------------------------- briefing */

export interface BriefingSection {
  key: string;
  title: string;
  items: { label: string; value: string; note?: string; tone?: 'default' | 'attention' | 'ok' }[];
}

export interface Briefing {
  generatedAt: string;
  dateLabel: string;
  greeting: string;
  headline: string;
  counts: { appointments: number; propertyTasks: number; travelMovements: number; pendingRequests: number };
  priority: { title: string; detail: string; actionLabel: string; actionHref: string } | null;
  sections: BriefingSection[];
  signature: string;
}

export function buildBriefing(user: { id: string; firstName: string; timezone?: string; briefingTime?: string }): Briefing {
  const db = getDb();
  const userId = user.id;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const hour = now.getUTCHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const appointments = Number(
    db.get<{ n: number }>(
      `SELECT (
         (SELECT COUNT(*) FROM reservations WHERE user_id = @userId AND date(starts_at) = @today)
       + (SELECT COUNT(*) FROM trip_legs WHERE user_id = @userId AND date(at) = @today)
       + (SELECT COUNT(*) FROM tasks WHERE user_id = @userId AND date(due_at) = @today AND status != 'done')
       ) AS n`,
      { userId, today },
    )?.n ?? 0,
  );

  const propertyTasks = Number(
    db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM tasks WHERE user_id = @userId AND property_id IS NOT NULL AND status IN ('pending','in_progress','awaiting_confirmation','blocked')`,
      { userId },
    )?.n ?? 0,
  );

  const travelMovements = Number(
    db.get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM trips WHERE user_id = @userId AND status IN ('confirmed','pending','in_progress')
         AND date(starts_at) BETWEEN date(@today) AND date(@today, '+10 day')`,
      { userId, today },
    )?.n ?? 0,
  );

  const pendingRequests = Number(
    db.get<{ n: number }>(
      `SELECT (
         (SELECT COUNT(*) FROM ai_tasks WHERE user_id = @userId AND status IN ('proposed','requires_confirmation'))
       + (SELECT COUNT(*) FROM tickets WHERE user_id = @userId AND status IN ('open','in_review'))
       ) AS n`,
      { userId },
    )?.n ?? 0,
  );

  const insights = buildInsights(userId);
  const priority = insights.length
    ? {
        title: insights[0].title,
        detail: insights[0].detail,
        actionLabel: insights[0].actionLabel,
        actionHref: insights[0].actionHref,
      }
    : null;

  const todaysReservations = db
    .all<{ title: string; vendor: string | null; starts_at: string | null; status: string }>(
      `SELECT title, vendor, starts_at, status FROM reservations WHERE user_id = @userId AND date(starts_at) = @today ORDER BY starts_at LIMIT 4`,
      { userId, today },
    );
  const todaysLegs = db
    .all<{ label: string; at: string | null; status: string; trip: string }>(
      `SELECT l.label, l.at, l.status, t.title AS trip FROM trip_legs l JOIN trips t ON t.id = l.trip_id
        WHERE l.user_id = @userId AND date(l.at) = @today ORDER BY l.at LIMIT 5`,
      { userId, today },
    );

  const schedule = [...todaysLegs.map((l) => ({ label: formatTimeOnly(l.at), value: `${l.label}`, note: `${l.trip} · ${label(l.status, {})}` })),
    ...todaysReservations.map((r) => ({ label: formatTimeOnly(r.starts_at), value: r.title, note: `${r.vendor ?? '—'} · ${label(r.status, {})}` }))].slice(0, 6);

  const residences = db
    .all<{ name: string; status: string; city: string; staff_on_site: number; temperature_c: number | null; next_service_at: string | null }>(
      `SELECT name, status, city, staff_on_site, temperature_c, next_service_at FROM properties WHERE user_id = @userId ORDER BY is_primary DESC, name LIMIT 6`,
      { userId },
    );

  const ledger = db
    .all<{ description: string; vendor: string | null; amount_cents: number; spent_on: string }>(
      `SELECT description, vendor, amount_cents, spent_on FROM expenses WHERE user_id = @userId ORDER BY spent_on DESC, created_at DESC LIMIT 4`,
      { userId },
    );

  const staff = db
    .all<{ name: string; role: string; next_task: string | null; status: string }>(
      `SELECT TRIM(s.first_name || ' ' || s.last_name) AS name, s.role, s.next_task, s.status FROM staff s
        WHERE s.user_id = @userId AND s.next_task IS NOT NULL AND s.next_task != 'None'
        ORDER BY s.last_name LIMIT 5`,
      { userId },
    );

  return {
    generatedAt: now.toISOString(),
    dateLabel: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    greeting: `${greeting}, ${user.firstName}.`,
    headline:
      appointments + propertyTasks + pendingRequests === 0
        ? 'Nothing in the household requires your attention today.'
        : 'Today in your private world, assembled from the records you hold with us.',
    counts: { appointments, propertyTasks, travelMovements, pendingRequests },
    priority,
    sections: [
      {
        key: 'schedule',
        title: 'Schedule',
        items: schedule.length
          ? schedule
          : [{ label: '—', value: 'No movements or reservations recorded for today', note: 'Add one in Travel or Lifestyle' }],
      },
      {
        key: 'residences',
        title: 'Residences',
        items: residences.map((row) => ({
          label: row.city,
          value: `${row.name} — ${label(row.status, {})}`,
          note: `${row.staff_on_site} on site · ${row.temperature_c ?? '—'}°C${row.next_service_at ? ` · next service ${new Date(row.next_service_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}` : ''}`,
          tone: row.status === 'operational' ? 'ok' : 'attention',
        })),
      },
      {
        key: 'people',
        title: 'People & next tasks',
        items: staff.length
          ? staff.map((row) => ({ label: row.name, value: row.next_task ?? 'No task assigned', note: `${label(row.role, {})} · ${label(row.status, {})}` }))
          : [{ label: '—', value: 'No outstanding assignments', note: 'Staff directory is clear' }],
      },
      {
        key: 'ledger',
        title: 'Last recorded expenditure',
        items: ledger.length
          ? ledger.map((row) => ({
              label: row.spent_on,
              value: `€${(row.amount_cents / 100).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`,
              note: `${row.description}${row.vendor ? ` · ${row.vendor}` : ''}`,
            }))
          : [{ label: '—', value: 'Nothing recorded yet this month', note: 'The ledger fills as your households invoice' }],
      },
    ],
    signature: 'Prepared by VELORA · figures are your own records, organised',
  };
}

function formatTimeOnly(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
}

/* ----------------------------------------------------------- search */

export interface SearchHit {
  id: string;
  group: string;
  title: string;
  detail: string;
  href: string;
}

export function globalSearch(userId: string, term: string, limit = 6): SearchHit[] {
  const q = term.trim();
  if (q.length < 1) return [];
  const db = getDb();
  const like = `%${q.slice(0, 60)}%`;
  const hits: SearchHit[] = [];

  const push = (rows: { id: string; title: string; detail: string | null; href: string }[], group: string) => {
    for (const row of rows.slice(0, limit)) hits.push({ id: row.id, group, title: row.title, detail: row.detail ?? '', href: row.href });
  };

  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, name AS title, city || ' · ' || country AS detail FROM properties WHERE user_id = @userId AND (name LIKE @like OR city LIKE @like OR notes LIKE @like) LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/properties/${r.id}` })),
    'Residences',
  );
  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, TRIM(first_name || ' ' || last_name) AS title, role AS detail FROM staff WHERE user_id = @userId AND (first_name LIKE @like OR last_name LIKE @like OR role LIKE @like OR next_task LIKE @like) LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/people?q=${encodeURIComponent(r.title)}` })),
    'People',
  );
  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, title, 'Due ' || IFNULL(date(due_at), 'unscheduled') AS detail FROM tasks WHERE user_id = @userId AND status != 'done' AND (title LIKE @like OR detail LIKE @like) LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/dashboard#tasks` })),
    'Open tasks',
  );
  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, name AS title, category AS detail FROM documents WHERE user_id = @userId AND (name LIKE @like OR owner LIKE @like OR tags LIKE @like) LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/documents?q=${encodeURIComponent(q)}` })),
    'Documents',
  );
  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, title, origin_city || ' → ' || destination_city AS detail FROM trips WHERE user_id = @userId AND (title LIKE @like OR origin_city LIKE @like OR destination_city LIKE @like) LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/travel?trip=${r.id}` })),
    'Travel',
  );
  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, make || ' ' || model AS title, IFNULL(location, '') AS detail FROM vehicles WHERE user_id = @userId AND (make LIKE @like OR model LIKE @like OR plate LIKE @like) LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/vehicles` })),
    'Vehicles',
  );
  push(
    db
      .all<{ id: string; title: string; detail: string | null }>(
        `SELECT id, description AS title, vendor AS detail FROM expenses WHERE user_id = @userId AND (description LIKE @like OR vendor LIKE @like) ORDER BY spent_on DESC LIMIT @limit`,
        { userId, like, limit },
      )
      .map((r) => ({ ...r, href: `/finance` })),
    'Ledger',
  );

  return hits.slice(0, 24);
}

/** Small helper reused by a few screens. */
export function staffFor(userId: string, propertyId?: string | null): StaffRow[] {
  return propertyId ? staffAll(userId).filter((s) => s.propertyId === propertyId) : staffAll(userId);
}
function staffAll(userId: string) {
  return getDb()
    .all<Record<string, unknown>>(`SELECT * FROM staff WHERE user_id = @userId ORDER BY last_name`, { userId })
    .map((row) => row as unknown as StaffRow);
}

export function reservationsFor(userId: string, propertyId: string | null): ReservationRow[] {
  return getDb()
    .all<Record<string, unknown>>(`SELECT * FROM reservations WHERE user_id = @userId AND IFNULL(property_id,'') = @propertyId ORDER BY starts_at DESC`, {
      userId,
      propertyId: propertyId ?? '',
    })
    .map((row) => row as unknown as ReservationRow);
}

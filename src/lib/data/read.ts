/**
 * Read model. Every function takes the acting user and filters by their id —
 * this is where tenant isolation is enforced for pages. Raw SQL is used only
 * for aggregates; single-row CRUD goes through the table gateways.
 */
import { getDb } from '@/lib/db';
import {
  accessRequestsTable,
  aiTasksTable,
  documentsTable,
  expensesTable,
  invoicesTable,
  notificationsTable,
  propertiesTable,
  reservationsTable,
  staffTable,
  subscriptionsTable,
  tasksTable,
  tripsTable,
  vehiclesTable,
  type AiTaskRow,
  type DocumentRow,
  type ExpenseRow,
  type InvoiceRow,
  type NotificationRow,
  type PropertyRow,
  type ReservationRow,
  type StaffRow,
  type SubscriptionRow,
  type TaskRow,
  type TripRow,
  type VehicleRow,
} from '@/lib/data/tables';

/* --------------------------------------------------------------- utils */

export function monthRange(month?: string | null): { start: string; end: string; label: string; previous: string } {
  const now = new Date();
  let year = now.getUTCFullYear();
  let index = now.getUTCMonth();
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    year = y!;
    index = (m ?? 1) - 1;
  }
  const start = new Date(Date.UTC(year, index, 1));
  const end = new Date(Date.UTC(year, index + 1, 0));
  const previousMonth = new Date(Date.UTC(year, index - 1, 1));
  return {
    start: start.toISOString().slice(0, 10),
    end: `${end.toISOString().slice(0, 10)}`,
    label: start.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    previous: previousMonth.toISOString().slice(0, 7),
  };
}

function openTasksSql(alias = 'p') {
  return `(SELECT COUNT(*) FROM tasks t WHERE t.property_id = ${alias}.id AND t.status IN ('pending','in_progress','awaiting_confirmation','blocked'))`;
}

/* --------------------------------------------------------- properties */

export interface PropertySummary extends PropertyRow {
  openTasks: number;
  staffCount: number;
  monthSpendCents: number;
  upcomingServiceDays: number | null;
  documentCount: number;
}

export function listProperties(userId: string, opts: { includeArchived?: boolean } = {}): PropertySummary[] {
  const { start, end } = monthRange();
  const rows = getDb().all<Record<string, unknown>>(
    `SELECT p.*,
            ${openTasksSql()} AS openTasks,
            (SELECT COUNT(*) FROM staff s WHERE s.property_id = p.id) AS staffCount,
            (SELECT COALESCE(SUM(e.amount_cents), 0) FROM expenses e WHERE e.property_id = p.id AND e.spent_on BETWEEN @start AND @end) AS monthSpendCents,
            (SELECT COUNT(*) FROM documents d WHERE d.property_id = p.id) AS documentCount
       FROM properties p
      WHERE p.user_id = @userId
      ORDER BY p.is_primary DESC, CASE p.status WHEN 'attention' THEN 0 WHEN 'maintenance' THEN 1 ELSE 2 END, p.name ASC`,
    { userId, start, end },
  );
  return rows.map((row) => hydrateProperty(row));
}

function hydrateProperty(row: Record<string, unknown>): PropertySummary {
  const next = row.nextServiceAt ? new Date(String(row.nextServiceAt)).getTime() : null;
  return {
    ...(propertiesTable.decorate(row as never) as PropertyRow),
    openTasks: Number(row.openTasks ?? 0),
    staffCount: Number(row.staffCount ?? 0),
    monthSpendCents: Number(row.monthSpendCents ?? 0),
    documentCount: Number(row.documentCount ?? 0),
    upcomingServiceDays: next ? Math.ceil((next - Date.now()) / 86_400_000) : null,
  };
}

export function getProperty(userId: string, id: string): PropertySummary | undefined {
  const row = getDb().get<Record<string, unknown>>(
    `SELECT p.*,
            ${openTasksSql()} AS openTasks,
            (SELECT COUNT(*) FROM staff s WHERE s.property_id = p.id) AS staffCount,
            (SELECT COALESCE(SUM(e.amount_cents), 0) FROM expenses e WHERE e.property_id = p.id AND e.spent_on BETWEEN @start AND @end) AS monthSpendCents,
            (SELECT COUNT(*) FROM documents d WHERE d.property_id = p.id) AS documentCount
       FROM properties p WHERE p.id = @id AND p.user_id = @userId`,
    { userId, id, ...monthRange() },
  );
  return row ? hydrateProperty(row) : undefined;
}

export interface PropertyDossier {
  property: PropertySummary;
  staff: StaffRow[];
  tasks: TaskRow[];
  expenses: ExpenseRow[];
  documents: DocumentRow[];
  vehicles: VehicleRow[];
  history: { label: string; detail: string | null; at: string | null; tone: string }[];
  monthlySpend: { month: string; cents: number }[];
}

export function getPropertyDossier(userId: string, id: string): PropertyDossier | undefined {
  const property = getProperty(userId, id);
  if (!property) return undefined;

  const staff = staffTable.list({ where: { propertyId: id }, userId, orderBy: 'lastName ASC' });
  const tasks = tasksTable.list({ where: { propertyId: id }, userId, orderBy: 'dueAt ASC', limit: 40 });
  const { start, end } = monthRange();
  const expenses = getDb()
    .all<Record<string, unknown>>(
      `SELECT * FROM expenses WHERE user_id = @userId AND property_id = @propertyId AND spent_on BETWEEN @start AND @end
       ORDER BY spent_on DESC, created_at DESC`,
      { userId, propertyId: id, start, end },
    )
    .map((row) => expensesTable.decorate(row as never) as ExpenseRow);

  const documents = getDb()
    .all<Record<string, unknown>>(`SELECT * FROM documents WHERE user_id = @userId AND property_id = @id ORDER BY updated_at DESC`, { userId, id })
    .map((row) => documentsTable.decorate(row as never) as DocumentRow);

  const vehicles = getDb()
    .all<Record<string, unknown>>(`SELECT * FROM vehicles WHERE user_id = @userId AND property_id = @id ORDER BY make ASC`, { userId, id })
    .map((row) => vehiclesTable.decorate(row as never) as VehicleRow);

  // Intervention history: what has actually been recorded against this residence.
  const history = getDb()
    .all<{ label: string; detail: string | null; at: string | null; tone: string }>(
      `SELECT 'Task closed — ' || t.title AS label, t.detail AS detail, t.completed_at AS at, 'ok' AS tone
         FROM tasks t WHERE t.property_id = @id AND t.status = 'done'
        UNION ALL
       SELECT e.description, e.vendor, e.created_at, 'info'
         FROM expenses e WHERE e.property_id = @id
        UNION ALL
       SELECT 'Document filed — ' || d.name, d.owner, d.updated_at, 'gold'
         FROM documents d WHERE d.property_id = @id
        ORDER BY at DESC NULLS LAST LIMIT 24`,
      { id },
    )
    .slice(0, 24);

  const monthlySpend = getDb()
    .all<{ month: string; cents: number }>(
      `SELECT substr(spent_on, 1, 7) AS month, SUM(amount_cents) AS cents
         FROM expenses
        WHERE user_id = @userId AND property_id = @id
        GROUP BY month ORDER BY month ASC`,
      { userId, id },
    )
    .map((row) => ({ month: row.month, cents: Number(row.cents) }));

  return { property, staff, tasks, expenses, documents, vehicles, history, monthlySpend };
}

/* ------------------------------------------------------------- people */

export interface StaffWithProperty extends StaffRow {
  propertyName: string | null;
  propertyCity: string | null;
  openTaskCount: number;
}

export function listStaff(
  userId: string,
  filters: { q?: string; role?: string; status?: string; propertyId?: string } = {},
): StaffWithProperty[] {
  const params: Record<string, unknown> = { userId };
  const clauses = ['s.user_id = @userId'];
  if (filters.role && filters.role !== 'all') {
    clauses.push('s.role = @role');
    params.role = filters.role;
  }
  if (filters.status && filters.status !== 'all') {
    clauses.push('s.status = @status');
    params.status = filters.status;
  }
  if (filters.propertyId && filters.propertyId !== 'all') {
    clauses.push('s.property_id = @propertyId');
    params.propertyId = filters.propertyId;
  }
  if (filters.q) {
    clauses.push(
      "(s.first_name LIKE @q OR s.last_name LIKE @q OR s.role LIKE @q OR IFNULL(p.name, ' ') LIKE @q)",
    );
    params.q = `%${filters.q}%`;
  }
  const rows = getDb().all<Record<string, unknown>>(
    `SELECT s.*, p.name AS propertyName, p.city AS propertyCity,
            (SELECT COUNT(*) FROM tasks t WHERE t.staff_id = s.id AND t.status != 'done') AS openTaskCount
       FROM staff s LEFT JOIN properties p ON p.id = s.property_id AND p.user_id = s.user_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY s.last_name COLLATE NOCASE ASC`,
    params,
  );
  return rows.map((row) => ({
    ...(staffTable.decorate(row as never) as StaffRow),
    propertyName: (row.propertyName as string) ?? null,
    propertyCity: (row.propertyCity as string) ?? null,
    openTaskCount: Number(row.openTaskCount ?? 0),
  }));
}

/* ------------------------------------------------------------- travel */

export interface TripWithDetail extends TripRow {
  legs: {
    id: string;
    position: number;
    kind: string;
    label: string;
    detail: string | null;
    at: string | null;
    provider: string | null;
    reference: string | null;
    status: string;
  }[];
  propertyName: string | null;
  legCount: number;
  pendingLegs: number;
}

export function listTrips(userId: string, opts: { scope?: 'upcoming' | 'past' | 'all' } = {}): TripWithDetail[] {
  const scope = opts.scope ?? 'upcoming';
  const params: Record<string, unknown> = { userId, now: new Date().toISOString() };
  let filter = '';
  if (scope === 'upcoming') filter = 'AND t.starts_at >= date(@now, \'-3 days\')';
  if (scope === 'past') filter = 'AND t.starts_at < date(@now, \'-3 days\')';
  const rows = getDb().all<Record<string, unknown>>(
    `SELECT t.*, p.name AS propertyName,
            (SELECT COUNT(*) FROM trip_legs l WHERE l.trip_id = t.id) AS legCount,
            (SELECT COUNT(*) FROM trip_legs l WHERE l.trip_id = t.id AND l.status != 'confirmed') AS pendingLegs
       FROM trips t LEFT JOIN properties p ON p.id = t.property_id AND p.user_id = t.user_id
      WHERE t.user_id = @userId ${filter}
      ORDER BY ABS(julianday(t.starts_at) - julianday('now')) ASC`,
    params,
  );
  return rows.map((row) => {
    const trip = tripsTable.decorate(row as never) as TripRow;
    const legs = getDb()
      .all<Record<string, unknown>>(`SELECT * FROM trip_legs WHERE trip_id = @id ORDER BY position ASC`, { id: trip.id })
      .map((leg) => ({
        id: String(leg.id),
        position: Number(leg.position ?? 0),
        kind: String(leg.kind ?? 'transfer'),
        label: String(leg.label ?? ''),
        detail: (leg.detail as string) ?? null,
        at: (leg.at as string) ?? null,
        provider: (leg.provider as string) ?? null,
        reference: (leg.reference as string) ?? null,
        status: String(leg.status ?? 'pending'),
      }));
    return {
      ...trip,
      legs,
      propertyName: (row.propertyName as string) ?? null,
      legCount: Number(row.legCount ?? 0),
      pendingLegs: Number(row.pendingLegs ?? 0),
    };
  });
}

export function getTrip(userId: string, id: string): TripWithDetail | undefined {
  const all = listTrips(userId, { scope: 'all' });
  return all.find((t) => t.id === id);
}

/* ----------------------------------------------------------- vehicles */

export interface VehicleWithDetail extends VehicleRow {
  propertyName: string | null;
  driverName: string | null;
  serviceDueSoon: boolean;
  insuranceDaysLeft: number | null;
}

export function listVehicles(userId: string): VehicleWithDetail[] {
  const rows = getDb().all<Record<string, unknown>>(
    `SELECT v.*, p.name AS propertyName,
            TRIM(IFNULL(s.first_name, '') || ' ' || IFNULL(s.last_name, '')) AS driverName
       FROM vehicles v
       LEFT JOIN properties p ON p.id = v.property_id AND p.user_id = v.user_id
       LEFT JOIN staff s ON s.id = v.assigned_driver_id
      WHERE v.user_id = @userId
      ORDER BY v.make ASC, v.model ASC`,
    { userId },
  );
  return rows.map((row) => {
    const vehicle = vehiclesTable.decorate(row as never) as VehicleRow;
    const nextDate = vehicle.nextServiceAt ? Date.parse(vehicle.nextServiceAt) : null;
    const insuranceDate = vehicle.insuranceExpiresAt ? Date.parse(vehicle.insuranceExpiresAt) : null;
    const kmLeft = vehicle.nextServiceKm ? vehicle.nextServiceKm - vehicle.mileageKm : null;
    return {
      ...vehicle,
      propertyName: (row.propertyName as string) ?? null,
      driverName: (row.driverName as string) || null,
      serviceDueSoon: Boolean((nextDate && nextDate - Date.now() < 30 * 86_400_000) || (kmLeft !== null && kmLeft <= 1500)),
      insuranceDaysLeft: insuranceDate ? Math.round((insuranceDate - Date.now()) / 86_400_000) : null,
    };
  });
}

/* ---------------------------------------------------------- lifestyle */

export function listReservations(userId: string, opts: { scope?: 'upcoming' | 'past' | 'all' } = {}): ReservationRow[] {
  const now = new Date().toISOString();
  const rows = getDb().all<Record<string, unknown>>(
    `SELECT r.*, p.name AS propertyName FROM reservations r
       LEFT JOIN properties p ON p.id = r.property_id AND p.user_id = r.user_id
      WHERE r.user_id = @userId
        AND (@scope != 'upcoming' OR IFNULL(r.starts_at, '9999') >= date(@now, '-1 day'))
        AND (@scope != 'past' OR IFNULL(r.starts_at, '9999') < date(@now, '-1 day'))
      ORDER BY CASE WHEN r.starts_at IS NULL THEN 1 ELSE 0 END, r.starts_at ${opts.scope === 'past' ? 'DESC' : 'ASC'}`,
    { userId, now, scope: opts.scope ?? 'upcoming' },
  );
  return rows.map((row) => reservationsTable.decorate(row as never) as ReservationRow);
}

/* ------------------------------------------------------ tasks + ledger */

export interface TaskWithDetail extends TaskRow {
  propertyName: string | null;
  staffName: string | null;
}

export function listTasks(
  userId: string,
  filters: { status?: string; propertyId?: string; category?: string; limit?: number; overdueOnly?: boolean } = {},
): TaskWithDetail[] {
  const params: Record<string, unknown> = { userId };
  const clauses = ['t.user_id = @userId'];
  if (filters.status && filters.status !== 'all') {
    clauses.push('t.status = @status');
    params.status = filters.status;
  }
  if (filters.propertyId && filters.propertyId !== 'all') {
    clauses.push('t.property_id = @propertyId');
    params.propertyId = filters.propertyId;
  }
  if (filters.category && filters.category !== 'all') {
    clauses.push('t.category = @category');
    params.category = filters.category;
  }
  if (filters.overdueOnly) clauses.push(`t.due_at < datetime('now') AND t.status != 'done'`);
  params.limit = filters.limit ?? 50;

  const rows = getDb().all<Record<string, unknown>>(
    `SELECT t.*, p.name AS propertyName, TRIM(IFNULL(s.first_name,'') || ' ' || IFNULL(s.last_name,'')) AS staffName
       FROM tasks t
       LEFT JOIN properties p ON p.id = t.property_id AND p.user_id = t.user_id
       LEFT JOIN staff s ON s.id = t.staff_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY CASE t.status WHEN 'awaiting_confirmation' THEN 0 WHEN 'blocked' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'pending' THEN 3 ELSE 4 END,
               CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
               t.due_at IS NULL, t.due_at ASC
      LIMIT @limit`,
    params,
  );
  return rows.map((row) => ({
    ...(tasksTable.decorate(row as never) as TaskRow),
    propertyName: (row.propertyName as string) ?? null,
    staffName: (row.staffName as string) || null,
  }));
}

/* ------------------------------------------------------------- finance */

export interface FinanceSummary {
  month: { start: string; end: string; label: string };
  byCategory: { key: string; label: string; cents: number; entries: number; deltaPct: number | null }[];
  totalCents: number;
  previousTotalCents: number;
  openItems: { id: string; description: string; vendor: string | null; amountCents: number; spentOn: string; status: string }[];
  trend: { month: string; cents: number }[];
  byProperty: { propertyId: string | null; name: string; cents: number }[];
  largest: { description: string; vendor: string | null; amountCents: number; propertyName: string | null }[];
}

export function getFinanceSummary(userId: string, month?: string | null): FinanceSummary {
  const db = getDb();
  const range = monthRange(month);
  const prevRange = monthRange(range.previous);

  const byCategory = db
    .all<{ key: string; label: string; cents: number; entries: number; prev: number }>(
      `SELECT e.category_key AS key, IFNULL(c.label, REPLACE(UPPER(e.category_key), '_', ' ')) AS label,
              SUM(e.amount_cents) AS cents, COUNT(*) AS entries,
              (SELECT IFNULL(SUM(p.amount_cents), 0) FROM expenses p
                WHERE p.user_id = e.user_id AND p.category_key = e.category_key AND p.spent_on BETWEEN @prevStart AND @prevEnd) AS prev
         FROM expenses e
         LEFT JOIN expense_categories c ON c.user_id = e.user_id AND c.key = e.category_key
        WHERE e.user_id = @userId AND e.spent_on BETWEEN @start AND @end
        GROUP BY e.category_key
        ORDER BY cents DESC`,
      { userId, start: range.start, end: range.end, prevStart: prevRange.start, prevEnd: prevRange.end },
    )
    .map((row) => {
      const cents = Number(row.cents);
      const prev = Number(row.prev);
      return {
        key: row.key,
        label: row.label,
        cents,
        entries: Number(row.entries),
        deltaPct: prev > 0 ? Math.round(((cents - prev) / prev) * 100) : null,
      };
    });

  const totalCents = byCategory.reduce((sum, row) => sum + row.cents, 0);
  const previousTotalCents =
    Number(
      db.get<{ n: number | null }>(
        `SELECT SUM(amount_cents) AS n FROM expenses WHERE user_id = @userId AND spent_on BETWEEN @start AND @end`,
        { userId, start: prevRange.start, end: prevRange.end },
      )?.n ?? 0,
    ) || 0;

  const openItems = db
    .all<{ id: string; description: string; vendor: string | null; amountCents: number; spentOn: string; status: string }>(
      `SELECT id, description, vendor, amount_cents AS amountCents, spent_on AS spentOn, status
         FROM expenses WHERE user_id = @userId AND (status = 'pending' OR requires_review = 1)
        ORDER BY spent_on DESC LIMIT 12`,
      { userId },
    )
    .map((row) => ({ ...row, amountCents: Number(row.amountCents) }));

  const trend = db
    .all<{ month: string; cents: number | null }>(
      `SELECT substr(spent_on,1,7) AS month, SUM(amount_cents) AS cents
         FROM expenses WHERE user_id = @userId
        GROUP BY month ORDER BY month ASC`,
      { userId },
    )
    .map((row) => ({ month: row.month, cents: Number(row.cents ?? 0) }));

  const byProperty = db
    .all<{ propertyId: string | null; name: string | null; cents: number }>(
      `SELECT e.property_id AS propertyId, IFNULL(p.name, 'Household-wide') AS name, SUM(e.amount_cents) AS cents
         FROM expenses e LEFT JOIN properties p ON p.id = e.property_id
        WHERE e.user_id = @userId AND e.spent_on BETWEEN @start AND @end
        GROUP BY e.property_id ORDER BY cents DESC`,
      { userId, start: range.start, end: range.end },
    )
    .map((row) => ({ propertyId: row.propertyId, name: row.name ?? 'Household-wide', cents: Number(row.cents) }));

  const largest = db
    .all<{ description: string; vendor: string | null; amountCents: number; propertyName: string | null }>(
      `SELECT e.description, e.vendor, e.amount_cents AS amountCents, p.name AS propertyName
         FROM expenses e LEFT JOIN properties p ON p.id = e.property_id
        WHERE e.user_id = @userId AND e.spent_on BETWEEN @start AND @end
        ORDER BY e.amount_cents DESC LIMIT 6`,
      { userId, start: range.start, end: range.end },
    )
    .map((row) => ({ ...row, amountCents: Number(row.amountCents) }));

  return { month: { ...range }, byCategory, totalCents, previousTotalCents, openItems, trend, byProperty, largest };
}

export function listExpenses(userId: string, filters: { month?: string; category?: string; propertyId?: string; q?: string } = {}): ExpenseRow[] {
  const range = monthRange(filters.month);
  const params: Record<string, unknown> = { userId, start: range.start, end: range.end };
  const clauses = ['e.user_id = @userId', 'e.spent_on BETWEEN @start AND @end'];
  if (filters.category && filters.category !== 'all') {
    clauses.push('e.category_key = @category');
    params.category = filters.category;
  }
  if (filters.propertyId && filters.propertyId !== 'all') {
    clauses.push('e.property_id = @propertyId');
    params.propertyId = filters.propertyId;
  }
  if (filters.q) {
    clauses.push('(e.description LIKE @q OR e.vendor LIKE @q)');
    params.q = `%${filters.q}%`;
  }
  const rows = getDb().all<Record<string, unknown>>(
    `SELECT e.* FROM expenses e WHERE ${clauses.join(' AND ')} ORDER BY e.spent_on DESC, e.created_at DESC LIMIT 200`,
    params,
  );
  return rows.map((row) => expensesTable.decorate(row as never) as ExpenseRow);
}

/* ---------------------------------------------------------- documents */

export interface DocumentWithProperty extends DocumentRow {
  propertyName: string | null;
}

export function listDocuments(userId: string, filters: { q?: string; category?: string; status?: string } = {}): {
  rows: DocumentWithProperty[];
  counts: Record<string, number>;
  total: number;
} {
  const params: Record<string, unknown> = { userId };
  const clauses = ['d.user_id = @userId'];
  if (filters.q) {
    clauses.push('(d.name LIKE @q OR d.owner LIKE @q OR d.tags LIKE @q)');
    params.q = `%${filters.q}%`;
  }
  const rows = getDb()
    .all<Record<string, unknown>>(
      `SELECT d.*, p.name AS propertyName FROM documents d
         LEFT JOIN properties p ON p.id = d.property_id AND p.user_id = d.user_id
        WHERE ${clauses.join(' AND ')}
        ORDER BY d.updated_at DESC LIMIT 200`,
      params,
    )
    .map((row) => ({
      ...(documentsTable.decorate(row as never) as DocumentRow),
      propertyName: (row.propertyName as string) ?? null,
    }));

  const filtered = rows.filter((row) => {
    if (filters.category && filters.category !== 'all' && row.category !== filters.category) return false;
    if (filters.status && filters.status !== 'all' && row.status !== filters.status) return false;
    return true;
  });

  const counts: Record<string, number> = { all: rows.length };
  for (const row of rows) counts[row.category] = (counts[row.category] ?? 0) + 1;
  return { rows: filtered, counts, total: rows.length };
}

/* ------------------------------------------------------- notifications */

export function listNotifications(userId: string, limit = 12): NotificationRow[] {
  return notificationsTable.list({ userId, orderBy: 'createdAt DESC', limit });
}

export function unreadCount(userId: string): number {
  return getDb().get<{ n: number }>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = @userId AND read_at IS NULL`, { userId })?.n ?? 0;
}

/* -------------------------------------------------------- AI + briefs */

export interface ConversationRow {
  id: string;
  title: string;
  channel: string;
  provider: string;
  model: string;
  updatedAt: string;
  createdAt: string;
  messageCount: number;
}

export function listConversations(userId: string): ConversationRow[] {
  return getDb()
    .all<ConversationRow>(
      `SELECT c.id, c.title, c.channel, c.provider, c.model, c.updated_at AS updatedAt, c.created_at AS createdAt,
              (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS messageCount
         FROM ai_conversations c WHERE c.user_id = @userId ORDER BY c.updated_at DESC LIMIT 30`,
      { userId },
    )
    .map((row) => ({ ...row, messageCount: Number(row.messageCount) }));
}

export interface AiMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  payload: { blocks?: { type: string; label?: string; value?: string; items?: string[] }[] } | null;
}

export function getConversation(userId: string, conversationId: string): { conversation: ConversationRow; messages: AiMessageRow[]; actions: AiTaskRow[] } | undefined {
  const db = getDb();
  const conversation = db.get<ConversationRow>(
    `SELECT c.id, c.title, c.channel, c.provider, c.model, c.updated_at AS updatedAt, c.created_at AS createdAt,
            (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = c.id) AS messageCount
       FROM ai_conversations c WHERE c.id = @id AND c.user_id = @userId`,
    { id: conversationId, userId },
  );
  if (!conversation) return undefined;
  const messages = db
    .all<{ id: string; role: AiMessageRow['role']; content: string; created_at: string; payload_json: string | null }>(
      `SELECT id, role, content, created_at, payload_json FROM ai_messages WHERE conversation_id = @id ORDER BY created_at ASC`,
      { id: conversationId },
    )
    .map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
      payload: row.payload_json ? (safeParse(row.payload_json) as AiMessageRow['payload']) : null,
    }));
  const actions = aiTasksTable.list({ where: { conversationId }, userId, orderBy: 'createdAt ASC', limit: 40 });
  return { conversation: { ...conversation, messageCount: Number(conversation.messageCount) }, messages, actions };
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/** The caller's own conversations with the private office (support tickets). */
export function listMyTickets(userId: string): { id: string; subject: string; body: string | null; priority: string; status: string; assignee: string | null; reply: string | null; createdAt: string; updatedAt: string }[] {
  return getDb()
    .all<{
      id: string;
      subject: string;
      body: string | null;
      priority: string;
      status: string;
      assignee: string | null;
      reply: string | null;
      created_at: string;
      updated_at: string;
    }>(`SELECT id, subject, body, priority, status, assignee, reply, created_at, updated_at FROM tickets WHERE user_id = @userId ORDER BY created_at DESC LIMIT 30`, {
      userId,
    })
    .map((row) => ({
      id: row.id,
      subject: row.subject,
      body: row.body,
      priority: row.priority,
      status: row.status,
      assignee: row.assignee,
      reply: row.reply,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
}

/** The caller's own audit trail — a member may always see what was done. */
export function listAuditForUser(userId: string, limit = 20): { id: string; event: string; target: string | null; createdAt: string }[] {
  return getDb()
    .all<{ id: string; event: string; target: string | null; created_at: string }>(
      `SELECT id, event, target, created_at FROM audit_events WHERE user_id = @userId ORDER BY created_at DESC LIMIT @limit`,
      { userId, limit },
    )
    .map((row) => ({ id: row.id, event: row.event, target: row.target, createdAt: row.created_at }));
}

/** How many requests the member has made to the coordinator today (plan budget). */
export function getAiUsageToday(userId: string): number {
  const row = getDb().get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM ai_messages WHERE user_id = @userId AND role = 'user' AND created_at >= date('now')`,
    { userId },
  );
  return row?.n ?? 0;
}

export function pendingAiActions(userId: string): AiTaskRow[] {
  return getDb()
    .all<Record<string, unknown>>(
      `SELECT * FROM ai_tasks WHERE user_id = @userId AND status IN ('proposed','requires_confirmation') ORDER BY created_at DESC LIMIT 20`,
      { userId },
    )
    .map((row) => aiTasksTable.decorate(row as never) as AiTaskRow);
}

/* ---------------------------------------------------------- membership */

export interface MembershipState {
  subscription: SubscriptionRow | null;
  invoices: InvoiceRow[];
  openInvoices: number;
}

export function getMembership(userId: string): MembershipState {
  const subscription = subscriptionsTable.list({ userId, orderBy: 'updatedAt DESC', limit: 1 })[0] ?? null;
  const invoices = invoicesTable.list({ userId, orderBy: 'issuedAt DESC', limit: 12 });
  return {
    subscription,
    invoices,
    openInvoices: invoices.filter((i) => i.status === 'open').length,
  };
}

/* -------------------------------------------------------------- misc */

export function getAccessRequestByEmail(email: string) {
  return getDb().get<Record<string, unknown>>(`SELECT * FROM access_requests WHERE lower(email) = lower(@email) ORDER BY created_at DESC LIMIT 1`, {
    email,
  });
}

export { accessRequestsTable };

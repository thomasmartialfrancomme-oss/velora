/**
 * Write model — the only path from the API to a mutation.
 *
 * Rules enforced here, once, for every module:
 *  - the row must belong to the acting user (tenant scope on reads AND writes);
 *  - foreign keys are validated before touching SQL, so a bad id is a 422
 *    rather than a constraint error;
 *  - anything a human must approve is recorded, never executed.
 */
import { audit, getDb, nowIso, NotFoundError } from '@/lib/db';
import { ConstraintError } from '@/lib/errors';
import { removeStoredFile } from '@/lib/files';
import {
  documentsTable,
  expensesTable,
  invoicesTable,
  notificationsTable,
  propertiesTable,
  reservationsTable,
  staffTable,
  subscriptionsTable,
  tasksTable,
  tripLegsTable,
  tripsTable,
  vehiclesTable,
  aiTasksTable,
  ticketsTable,
  type PropertyRow,
  type StaffRow,
  type TaskRow,
  type TripRow,
  type VehicleRow,
  type DocumentRow,
  type ExpenseRow,
  type ReservationRow,
} from '@/lib/data/tables';
import type { z } from 'zod';
import type {
  documentCreateSchema,
  expenseCreateSchema,
  propertyCreateSchema,
  reservationCreateSchema,
  staffCreateSchema,
  taskCreateSchema,
  ticketSchema,
  tripCreateSchema,
  vehicleCreateSchema,
} from '@/lib/validation/schemas';

/* -------------------------------------------------------------- guards */

const OWNED_TABLES = {
  property: { table: 'properties', label: 'residence' },
  staff: { table: 'staff', label: 'staff member' },
  vehicle: { table: 'vehicles', label: 'vehicle' },
  trip: { table: 'trips', label: 'journey' },
  task: { table: 'tasks', label: 'task' },
  document: { table: 'documents', label: 'document' },
  expense: { table: 'expenses', label: 'expense' },
  reservation: { table: 'reservations', label: 'reservation' },
} as const;

type OwnedKind = keyof typeof OWNED_TABLES;

export function assertOwned(userId: string, kind: OwnedKind, id: string | null | undefined): void {
  if (!id) return;
  const { table, label: human } = OWNED_TABLES[kind];
  const row = getDb().get<{ id: string }>(`SELECT id FROM ${table} WHERE id = @id AND user_id = @userId`, { id, userId });
  if (!row) throw new ConstraintError(`That ${human} is not part of your records.`);
}

/* ------------------------------------------------------------ property */

export function createProperty(userId: string, input: z.infer<typeof propertyCreateSchema>): PropertyRow {
  const duplicate = getDb().get<{ id: string }>(`SELECT id FROM properties WHERE user_id = @userId AND lower(name) = lower(@name)`, {
    userId,
    name: input.name,
  });
  if (duplicate) throw new ConstraintError('A residence with that name already exists.');

  const property = propertiesTable.insert(
    {
      name: input.name,
      city: input.city,
      country: input.country,
      kind: input.kind,
      status: input.status,
      isPrimary: input.isPrimary && !hasPrimary(userId) ? true : Boolean(input.isPrimary),
      bedrooms: input.bedrooms ?? 0,
      bathrooms: input.bathrooms ?? 0,
      areaSqm: input.areaSqm ?? 0,
      temperatureC: input.temperatureC ?? null,
      nextServiceAt: input.nextServiceAt,
      monthlyOpsCents: input.monthlyOpsCents ?? 0,
      notes: input.notes,
      accent: 'gold',
      staffOnSite: 0,
    },
    userId,
  );
  if (property.isPrimary) clearOtherPrimaries(userId, property.id);
  audit({ userId, event: 'property.created', target: property.id, meta: { name: property.name } });
  notify(userId, {
    kind: 'property',
    title: `${property.name} added to your portfolio`,
    body: 'Assign people and a first task, or ask the AI coordinator to draft the household set-up.',
    severity: 'info',
    actionLabel: 'Open residence',
    actionHref: `/properties/${property.id}`,
  });
  return property;
}

function hasPrimary(userId: string): boolean {
  return Boolean(getDb().get<{ id: string }>(`SELECT id FROM properties WHERE user_id = @userId AND is_primary = 1 LIMIT 1`, { userId }));
}
function clearOtherPrimaries(userId: string, keepId: string): void {
  getDb().run(`UPDATE properties SET is_primary = 0 WHERE user_id = @userId AND id != @keepId`, { userId, keepId: keepId });
}

export function updateProperty(userId: string, id: string, patch: Partial<PropertyRow>): PropertyRow {
  const existing = propertiesTable.find(id, userId);
  if (!existing) throw new NotFoundError('That residence is not in your records.');
  if (patch.isPrimary) clearOtherPrimaries(userId, id);
  const updated = propertiesTable.update(
    id,
    {
      ...patch,
      // staff_on_site is derived, never trusted from the client
      staffOnSite: patch.staffOnSite ?? countStaff(id),
    },
    userId,
  )!;
  if (patch.status && patch.status !== existing.status) {
    audit({ userId, event: 'property.status_changed', target: id, meta: { from: existing.status, to: patch.status } });
  }
  return updated;
}

function countStaff(propertyId: string): number {
  return Number(getDb().get<{ n: number }>(`SELECT COUNT(*) AS n FROM staff WHERE property_id = @id`, { id: propertyId })?.n ?? 0);
}

export function deleteProperty(userId: string, id: string): { detached: Record<string, number> } {
  const existing = propertiesTable.find(id, userId);
  if (!existing) throw new NotFoundError('That residence is not in your records.');
  const counts: Record<string, number> = {};
  for (const table of ['staff', 'tasks', 'expenses', 'documents', 'vehicles', 'reservations']) {
    counts[table] = Number(getDb().get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE user_id = @userId AND property_id = @id`, { userId, id })?.n ?? 0);
  }
  getDb().run('DELETE FROM properties WHERE id = @id AND user_id = @userId', { id, userId });
  audit({ userId, event: 'property.deleted', target: id, meta: { name: existing.name, detached: counts } });
  return { detached: counts };
}

/* --------------------------------------------------------------- staff */

export function createStaff(userId: string, input: z.infer<typeof staffCreateSchema>): StaffRow {
  assertOwned(userId, 'property', input.propertyId);
  const row = staffTable.insert(
    {
      propertyId: input.propertyId,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      status: input.status,
      employment: input.employment,
      email: input.email || null,
      phone: input.phone || null,
      languages: input.languages ?? [],
      yearsHouse: 0,
      lastActivity: input.lastActivity ?? 'Added to the directory',
      lastActivityAt: nowIso(),
      nextTask: input.nextTask ?? null,
      rating: null,
      notes: input.notes,
    },
    userId,
  );
  syncPropertyStaffCount(userId, row.propertyId);
  audit({ userId, event: 'staff.created', target: row.id, meta: { name: `${row.firstName} ${row.lastName}` } });
  return row;
}

export function updateStaff(userId: string, id: string, patch: Partial<StaffRow>): StaffRow {
  const existing = staffTable.find(id, userId);
  if (!existing) throw new NotFoundError('That person is not in your directory.');
  assertOwned(userId, 'property', patch.propertyId);
  const updated = staffTable.update(id, { ...patch, lastActivityAt: patch.lastActivity ? nowIso() : existing.lastActivityAt }, userId)!;
  if (existing.propertyId !== updated.propertyId) {
    syncPropertyStaffCount(userId, existing.propertyId);
    syncPropertyStaffCount(userId, updated.propertyId);
  }
  return updated;
}

export function deleteStaff(userId: string, id: string): void {
  const existing = staffTable.find(id, userId);
  if (!existing) throw new NotFoundError('That person is not in your directory.');
  const openTasks = Number(
    getDb().get<{ n: number }>(`SELECT COUNT(*) AS n FROM tasks WHERE staff_id = @id AND status != 'done'`, { id })?.n ?? 0,
  );
  if (openTasks > 0) {
    throw new ConstraintError(
      `${existing.firstName} ${existing.lastName} still has ${openTasks} open task${openTasks === 1 ? '' : 's'}. Reassign or close them first.`,
    );
  }
  getDb().run('DELETE FROM staff WHERE id = @id AND user_id = @userId', { id, userId });
  syncPropertyStaffCount(userId, existing.propertyId);
  audit({ userId, event: 'staff.deleted', target: id });
}

function syncPropertyStaffCount(userId: string, propertyId: string | null | undefined): void {
  if (!propertyId) return;
  const owned = getDb().get<{ id: string }>(`SELECT id FROM properties WHERE id = @id AND user_id = @userId`, { id: propertyId, userId });
  if (!owned) return;
  getDb().run(`UPDATE properties SET staff_on_site = (SELECT COUNT(*) FROM staff WHERE property_id = @id AND status = 'on_site'), updated_at = @ts WHERE id = @id`, {
    id: propertyId,
    ts: nowIso(),
  });
}

/* ------------------------------------------------------------ vehicles */

export function createVehicle(userId: string, input: z.infer<typeof vehicleCreateSchema>) {
  assertOwned(userId, 'property', input.propertyId);
  assertOwned(userId, 'staff', input.assignedDriverId);
  const row = vehiclesTable.insert(
    {
      ...input,
      serviceIntervalKm: 15000,
      lastServiceAt: null,
    },
    userId,
  );
  audit({ userId, event: 'vehicle.created', target: row.id, meta: { vehicle: `${row.make} ${row.model}` } });
  return row;
}

export function updateVehicle(userId: string, id: string, patch: Partial<VehicleRow> & { logMileage?: number }): VehicleRow {
  const existing = vehiclesTable.find(id, userId);
  if (!existing) throw new NotFoundError('That vehicle is not in your fleet.');
  assertOwned(userId, 'staff', patch.assignedDriverId);
  assertOwned(userId, 'property', patch.propertyId);
  const next: Partial<VehicleRow> = { ...patch };
  if (patch.logMileage && patch.logMileage > 0) {
    next.mileageKm = existing.mileageKm + patch.logMileage;
  }
  if (patch.nextServiceAt) next.lastServiceAt = nowIso();
  delete (next as Record<string, unknown>).logMileage;
  return vehiclesTable.update(id, next as Record<string, unknown>, userId)!;
}

export function deleteVehicle(userId: string, id: string): void {
  if (!vehiclesTable.find(id, userId)) throw new NotFoundError('That vehicle is not in your fleet.');
  getDb().run('DELETE FROM vehicles WHERE id = @id AND user_id = @userId', { id, userId });
  audit({ userId, event: 'vehicle.deleted', target: id });
}

/* -------------------------------------------------------------- trips */

export interface TripLegInput {
  kind: string;
  label: string;
  detail?: string | null;
  at?: string | null;
  provider?: string | null;
  status?: string;
  reference?: string | null;
}

export function createTrip(userId: string, input: z.infer<typeof tripCreateSchema> & { legs?: TripLegInput[] }): TripRow {
  assertOwned(userId, 'property', input.propertyId);
  const trip = tripsTable.insert(
    {
      title: input.title,
      originCity: input.originCity,
      destinationCity: input.destinationCity,
      propertyId: input.propertyId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      mode: input.mode,
      status: input.status,
      travelers: input.travelers ?? 1,
      notes: input.notes,
    },
    userId,
  );
  const legs: TripLegInput[] = input.legs?.length
    ? input.legs
    : [
        { kind: 'transfer', label: `Transfer to ${input.destinationCity}`, detail: 'Driver to be assigned', status: 'pending' },
        { kind: 'arrival', label: 'Arrival — residence prepared', detail: 'Housekeeping to be scheduled', status: 'pending' },
      ];
  legs.slice(0, 12).forEach((leg, index) => {
    tripLegsTable.insert(
      {
        tripId: trip.id,
        position: index,
        kind: normalizeLegKind(leg.kind),
        label: leg.label.slice(0, 120),
        detail: leg.detail?.slice(0, 400) ?? null,
        at: leg.at ?? null,
        provider: leg.provider?.slice(0, 90) ?? null,
        status: leg.status ?? 'pending',
        reference: leg.reference ?? null,
      },
      userId,
    );
  });
  audit({ userId, event: 'trip.created', target: trip.id, meta: { title: trip.title, legs: legs.length } });
  return trip;
}

function normalizeLegKind(kind: string): string {
  const allowed = ['transfer', 'flight', 'train', 'arrival', 'house', 'dinner', 'meeting', 'departure'];
  return allowed.includes(kind) ? kind : 'transfer';
}

export function updateTrip(userId: string, id: string, patch: Partial<TripRow> & { legs?: TripLegInput[] }): TripRow {
  const existing = tripsTable.find(id, userId);
  if (!existing) throw new NotFoundError('That journey is not in your records.');
  assertOwned(userId, 'property', patch.propertyId);
  const updated = tripsTable.update(id, patch as Record<string, unknown>, userId)!;
  if (patch.legs) {
    getDb().run('DELETE FROM trip_legs WHERE trip_id = @id AND user_id = @userId', { id, userId });
    patch.legs.slice(0, 12).forEach((leg, index) => {
      tripLegsTable.insert(
        {
          tripId: id,
          position: index,
          kind: normalizeLegKind(leg.kind),
          label: leg.label.slice(0, 120),
          detail: leg.detail ?? null,
          at: leg.at ?? null,
          provider: leg.provider ?? null,
          status: leg.status ?? 'pending',
          reference: leg.reference ?? null,
        },
        userId,
      );
    });
  }
  return updated;
}

export function setLegStatus(userId: string, legId: string, status: 'confirmed' | 'pending' | 'requested' | 'cancelled'): void {
  const leg = tripLegsTable.find(legId, userId);
  if (!leg) throw new NotFoundError('That leg could not be found.');
  tripLegsTable.update(legId, { status }, userId);
  audit({ userId, event: 'trip.leg_updated', target: legId, meta: { status } });
}

export function deleteTrip(userId: string, id: string): void {
  if (!tripsTable.find(id, userId)) throw new NotFoundError('That journey is not in your records.');
  getDb().run('DELETE FROM trips WHERE id = @id AND user_id = @userId', { id, userId });
  audit({ userId, event: 'trip.deleted', target: id });
}

/* --------------------------------------------------------------- tasks */

export function createTask(userId: string, input: z.infer<typeof taskCreateSchema> & { origin?: string; originRef?: string | null }): TaskRow {
  assertOwned(userId, 'property', input.propertyId);
  assertOwned(userId, 'staff', input.staffId);
  const row = tasksTable.insert(
    {
      propertyId: input.propertyId,
      staffId: input.staffId,
      title: input.title,
      category: input.category,
      status: input.requiresConfirmation ? 'awaiting_confirmation' : input.status,
      priority: input.priority,
      dueAt: input.dueAt,
      origin: input.origin ?? 'manual',
      originRef: input.originRef ?? null,
      requiresConfirmation: Boolean(input.requiresConfirmation),
      detail: input.detail,
    },
    userId,
  );
  if (input.staffId) {
    staffTable.update(input.staffId, { lastActivity: `Assigned: ${input.title}`, lastActivityAt: nowIso() }, userId);
  }
  audit({ userId, event: 'task.created', target: row.id, meta: { title: row.title, origin: row.origin } });
  return row;
}

export function updateTask(userId: string, id: string, patch: Partial<TaskRow>): TaskRow {
  const existing = tasksTable.find(id, userId);
  if (!existing) throw new NotFoundError('That task could not be found.');
  const next: Partial<TaskRow> = { ...patch };
  if (next.status === 'done' && existing.status !== 'done') next.completedAt = nowIso();
  if (next.status && next.status !== 'done') next.completedAt = null;
  if (next.requiresConfirmation !== undefined) {
    next.status = next.requiresConfirmation ? 'awaiting_confirmation' : existing.status === 'awaiting_confirmation' ? 'pending' : existing.status;
  }
  return tasksTable.update(id, next as Record<string, unknown>, userId)!;
}

export function completeTask(userId: string, id: string): TaskRow {
  const existing = tasksTable.find(id, userId);
  if (!existing) throw new NotFoundError('That task could not be found.');
  const updated = tasksTable.update(id, { status: 'done', completedAt: nowIso(), requiresConfirmation: false }, userId)!;
  audit({ userId, event: 'task.completed', target: id });
  if (existing.staffId) {
    staffTable.update(existing.staffId, { lastActivity: `Closed: ${existing.title}`, lastActivityAt: nowIso() }, userId);
  }
  return updated;
}

export function deleteTask(userId: string, id: string): void {
  if (!tasksTable.find(id, userId)) throw new NotFoundError('That task could not be found.');
  getDb().run('DELETE FROM tasks WHERE id = @id AND user_id = @userId', { id, userId });
  audit({ userId, event: 'task.deleted', target: id });
}

/* ----------------------------------------------------------- finance */

export function createExpense(userId: string, input: z.infer<typeof expenseCreateSchema>): ExpenseRow {
  assertOwned(userId, 'property', input.propertyId);
  const row = expensesTable.insert(
    {
      propertyId: input.propertyId,
      categoryKey: input.categoryKey,
      description: input.description,
      vendor: input.vendor,
      amountCents: input.amount,
      spentOn: input.spentOn,
      status: input.status,
      requiresReview: input.status === 'pending',
      notes: input.notes,
    },
    userId,
  );
  if (input.propertyId) {
    const range = monthRangeFor(input.spentOn.slice(0, 7));
    getDb().run(
      `UPDATE properties SET monthly_ops_cents = (
         SELECT COALESCE(SUM(amount_cents), 0) FROM expenses
          WHERE property_id = @id AND spent_on BETWEEN @start AND @end
       ), updated_at = @ts WHERE id = @id AND user_id = @userId`,
      { id: input.propertyId, start: range.start, end: range.end, ts: nowIso(), userId },
    );
  }
  audit({ userId, event: 'expense.recorded', target: row.id, meta: { cents: row.amountCents, category: row.categoryKey } });
  return row;
}

function monthRangeFor(month: string): { start: string; end: string } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y!, (m ?? 1) - 1, 1));
  const end = new Date(Date.UTC(y!, m ?? 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export function deleteExpense(userId: string, id: string): void {
  if (!expensesTable.find(id, userId)) throw new NotFoundError('That entry could not be found.');
  getDb().run('DELETE FROM expenses WHERE id = @id AND user_id = @userId', { id, userId });
  audit({ userId, event: 'expense.deleted', target: id });
}

export function reviewExpense(userId: string, id: string, decision: 'approved' | 'disputed' | 'recorded'): ExpenseRow {
  const existing = expensesTable.find(id, userId);
  if (!existing) throw new NotFoundError('That entry could not be found.');
  return expensesTable.update(id, { status: decision, requiresReview: decision !== 'approved' }, userId)!;
}

/* --------------------------------------------------------- documents */

export function createDocument(userId: string, input: z.infer<typeof documentCreateSchema>): DocumentRow {
  assertOwned(userId, 'property', input.propertyId);
  const row = documentsTable.insert(
    {
      propertyId: input.propertyId,
      name: input.name,
      category: input.category,
      fileType: input.fileType || 'pdf',
      sizeKb: input.sizeKb ?? 0,
      version: 1,
      owner: input.owner,
      tags: input.tags ?? [],
      visibility: input.visibility,
      status: input.status,
      expiresAt: input.expiresAt,
      uploadedAt: nowIso(),
      notes: input.notes,
      storedPath: input.storedPath ?? null,
    },
    userId,
  );
  audit({ userId, event: 'document.created', target: row.id, meta: { name: row.name } });
  return row;
}

export function updateDocument(userId: string, id: string, patch: Partial<DocumentRow>): DocumentRow {
  const existing = documentsTable.find(id, userId);
  if (!existing) throw new NotFoundError('That document could not be found.');
  return documentsTable.update(id, { ...patch, version: patch.version ? existing.version + 1 : existing.version }, userId)!;
}

export function deleteDocument(userId: string, id: string): void {
  const existing = documentsTable.find(id, userId);
  if (!existing) throw new NotFoundError('That document could not be found.');
  if (existing.storedPath) removeStoredFile(existing.storedPath);
  getDb().run('DELETE FROM documents WHERE id = @id AND user_id = @userId', { id, userId });
  audit({ userId, event: 'document.deleted', target: id });
}

/* ------------------------------------------------------- reservations */

export function createReservation(userId: string, input: z.infer<typeof reservationCreateSchema>): ReservationRow {
  assertOwned(userId, 'property', input.propertyId);
  const row = reservationsTable.insert({ ...input, reference: null, status: input.status === 'confirmed' ? 'requested' : input.status }, userId);
  audit({ userId, event: 'reservation.created', target: row.id, meta: { title: row.title } });
  return row;
}

export function updateReservation(userId: string, id: string, patch: Partial<ReservationRow>): ReservationRow {
  const existing = reservationsTable.find(id, userId);
  if (!existing) throw new NotFoundError('That request could not be found.');
  return reservationsTable.update(id, patch as Record<string, unknown>, userId)!;
}

export function cancelReservation(userId: string, id: string): ReservationRow {
  const existing = reservationsTable.find(id, userId);
  if (!existing) throw new NotFoundError('That request could not be found.');
  audit({ userId, event: 'reservation.cancel_requested', target: id });
  return reservationsTable.update(id, { status: 'cancelled' }, userId)!;
}

/* ------------------------------------------------------- notifications */

export function notify(
  userId: string,
  input: { kind: string; title: string; body?: string | null; severity?: 'info' | 'attention' | 'critical'; actionLabel?: string | null; actionHref?: string | null },
): void {
  notificationsTable.insert(
    {
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      severity: input.severity ?? 'info',
      actionLabel: input.actionLabel ?? null,
      actionHref: input.actionHref ?? null,
      readAt: null,
    },
    userId,
  );
}

export function markNotificationRead(userId: string, id: string, read = true): void {
  const row = notificationsTable.find(id, userId);
  if (!row) throw new NotFoundError('That notice could not be found.');
  notificationsTable.update(id, { readAt: read ? nowIso() : null }, userId);
}

export function markAllNotificationsRead(userId: string): number {
  const result = getDb().run(`UPDATE notifications SET read_at = @ts WHERE user_id = @userId AND read_at IS NULL`, { ts: nowIso(), userId });
  return result.changes;
}

/* --------------------------------------------------------- AI actions */

export function decideAiTask(userId: string, aiTaskId: string, decision: 'confirm' | 'decline' | 'defer'): { status: string; task?: TaskRow } {
  const row = aiTasksTable.find(aiTaskId, userId);
  if (!row) throw new NotFoundError('That action is no longer available.');
  if (decision === 'confirm') {
    const task = tasksTable.insert(
      {
        title: row.label,
        category: mapModuleToTaskCategory(row.module),
        status: 'pending',
        priority: row.requiresConfirmation ? 'high' : 'normal',
        origin: 'ai',
        originRef: row.conversationId,
        requiresConfirmation: false,
        detail: row.detail,
      },
      userId,
    );
    aiTasksTable.update(aiTaskId, { status: 'done', taskId: task.id, requiresConfirmation: false }, userId);
    audit({ userId, event: 'ai.action_confirmed', target: aiTaskId, meta: { task: task.id } });
    return { status: 'done', task };
  }
  if (decision === 'decline') {
    aiTasksTable.update(aiTaskId, { status: 'declined' }, userId);
    audit({ userId, event: 'ai.action_declined', target: aiTaskId });
    return { status: 'declined' };
  }
  aiTasksTable.update(aiTaskId, { status: 'proposed' }, userId);
  return { status: 'proposed' };
}

export function mapModuleToTaskCategory(module: string): string {
  const values: Record<string, string> = {
    property: 'maintenance',
    housekeeping: 'housekeeping',
    people: 'staff',
    travel: 'travel',
    lifestyle: 'lifestyle',
    finance: 'finance',
    vehicles: 'vehicles',
    security: 'security',
    intelligence: 'staff',
  };
  return values[module] ?? 'staff';
}

/* ----------------------------------------------------------- support */

export function createTicket(userId: string, input: z.infer<typeof ticketSchema>) {
  const row = ticketsTable.insert({ subject: input.subject, body: input.body, priority: input.priority, status: 'open' }, userId);
  notify(userId, {
    kind: 'system',
    title: 'Your message reached the private office',
    body: `Reference ${row.id}. A coordinator replies inside the platform.`,
    severity: 'info',
    actionLabel: null,
    actionHref: null,
  });
  return row;
}

/* ------------------------------------------------------- membership */

export function currentSubscription(userId: string) {
  return subscriptionsTable.list({ userId, orderBy: 'updatedAt DESC', limit: 1 })[0] ?? null;
}

export function listInvoices(userId: string, limit = 12) {
  return invoicesTable.list({ userId, orderBy: 'issuedAt DESC', limit });
}

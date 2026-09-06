/**
 * Table definitions: the contract between the UI, the API and SQLite.
 * `writable: false` columns (tenant key, audit timestamps) cannot be set by a
 * request body, only by the server.
 */
import { Table, type TableSchema } from '@/lib/db/query';

const timestamps = {
  createdAt: { column: 'created_at', type: 'text', writable: false },
  updatedAt: { column: 'updated_at', type: 'text', writable: false },
} as const;

const common = {
  id: { column: 'id', type: 'text' },
  userId: { column: 'user_id', type: 'text', writable: false },
} as const;

/* --------------------------------------------------------------- types */

export interface PropertyRow {
  id: string;
  userId: string;
  name: string;
  city: string;
  country: string;
  kind: string;
  status: string;
  isPrimary: boolean;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  staffOnSite: number;
  temperatureC: number | null;
  humidityPct: number | null;
  lastMaintenanceAt: string | null;
  nextServiceAt: string | null;
  monthlyOpsCents: number;
  notes: string | null;
  accent: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffRow {
  id: string;
  userId: string;
  propertyId: string | null;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  employment: string;
  email: string | null;
  phone: string | null;
  languages: string[];
  yearsHouse: number;
  lastActivity: string | null;
  lastActivityAt: string | null;
  nextTask: string | null;
  rating: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VehicleRow {
  id: string;
  userId: string;
  propertyId: string | null;
  make: string;
  model: string;
  year: number;
  plate: string | null;
  kind: string;
  mileageKm: number;
  serviceIntervalKm: number;
  lastServiceAt: string | null;
  nextServiceAt: string | null;
  nextServiceKm: number | null;
  insuranceProvider: string | null;
  insuranceStatus: string;
  insuranceExpiresAt: string | null;
  location: string | null;
  assignedDriverId: string | null;
  status: string;
  fuelLevelPct: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripRow {
  id: string;
  userId: string;
  title: string;
  originCity: string;
  destinationCity: string;
  propertyId: string | null;
  startsAt: string;
  endsAt: string | null;
  mode: string;
  status: string;
  travelers: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TripLegRow {
  id: string;
  userId: string;
  tripId: string;
  position: number;
  kind: string;
  label: string;
  detail: string | null;
  at: string | null;
  provider: string | null;
  reference: string | null;
  status: string;
}

export interface TaskRow {
  id: string;
  userId: string;
  propertyId: string | null;
  staffId: string | null;
  title: string;
  category: string;
  status: string;
  priority: string;
  dueAt: string | null;
  completedAt: string | null;
  origin: string;
  originRef: string | null;
  requiresConfirmation: boolean;
  detail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseRow {
  id: string;
  userId: string;
  propertyId: string | null;
  categoryKey: string;
  description: string;
  vendor: string | null;
  amountCents: number;
  spentOn: string;
  status: string;
  requiresReview: boolean;
  notes: string | null;
  createdAt: string;
}

export interface DocumentRow {
  id: string;
  userId: string;
  propertyId: string | null;
  name: string;
  category: string;
  fileType: string;
  sizeKb: number;
  version: number;
  owner: string | null;
  tags: string[];
  visibility: string;
  status: string;
  expiresAt: string | null;
  uploadedAt: string;
  updatedAt: string;
  notes: string | null;
  /** path relative to data/uploads, set by the upload endpoint only */
  storedPath: string | null;
}

export interface ReservationRow {
  id: string;
  userId: string;
  propertyId: string | null;
  kind: string;
  title: string;
  vendor: string | null;
  city: string | null;
  startsAt: string | null;
  guests: number;
  status: string;
  reference: string | null;
  dressCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRow {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string | null;
  severity: string;
  actionLabel: string | null;
  actionHref: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface AiTaskRow {
  id: string;
  userId: string;
  conversationId: string | null;
  label: string;
  module: string;
  status: string;
  requiresConfirmation: boolean;
  confidence: number;
  detail: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRow {
  id: string;
  userId: string;
  plan: string;
  status: string;
  billingCycle: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  startedAt: string;
  cancelledAt: string | null;
  updatedAt: string;
}

export interface InvoiceRow {
  id: string;
  userId: string;
  subscriptionId: string | null;
  number: string;
  description: string;
  amountCents: number;
  currency: string;
  status: string;
  issuedAt: string;
  paidAt: string | null;
  receiptUrl: string | null;
}

export interface AccessRequestRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  country: string;
  residences: number;
  primaryRequirement: string;
  message: string | null;
  referrer: string | null;
  status: string;
  reviewerNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketRow {
  id: string;
  userId: string;
  subject: string;
  body: string | null;
  priority: string;
  status: string;
  assignee: string | null;
  reply: string | null;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------- schemas */

const propertySchema: TableSchema = {
  table: 'properties',
  idPrefix: 'prop',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    name: { column: 'name', type: 'text' },
    city: { column: 'city', type: 'text' },
    country: { column: 'country', type: 'text' },
    kind: { column: 'kind', type: 'text' },
    status: { column: 'status', type: 'text' },
    isPrimary: { column: 'is_primary', type: 'bool' },
    bedrooms: { column: 'bedrooms', type: 'int' },
    bathrooms: { column: 'bathrooms', type: 'int' },
    areaSqm: { column: 'area_sqm', type: 'int' },
    staffOnSite: { column: 'staff_on_site', type: 'int' },
    temperatureC: { column: 'temperature_c', type: 'real' },
    humidityPct: { column: 'humidity_pct', type: 'real' },
    lastMaintenanceAt: { column: 'last_maintenance_at', type: 'timestamp' },
    nextServiceAt: { column: 'next_service_at', type: 'timestamp' },
    monthlyOpsCents: { column: 'monthly_ops_cents', type: 'int' },
    notes: { column: 'notes', type: 'text' },
    accent: { column: 'accent', type: 'text' },
    ...timestamps,
  },
};

const staffSchema: TableSchema = {
  table: 'staff',
  idPrefix: 'stf',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    propertyId: { column: 'property_id', type: 'text' },
    firstName: { column: 'first_name', type: 'text' },
    lastName: { column: 'last_name', type: 'text' },
    role: { column: 'role', type: 'text' },
    status: { column: 'status', type: 'text' },
    employment: { column: 'employment', type: 'text' },
    email: { column: 'email', type: 'text' },
    phone: { column: 'phone', type: 'text' },
    languages: { column: 'languages', type: 'json' },
    yearsHouse: { column: 'years_with_house', type: 'int' },
    lastActivity: { column: 'last_activity', type: 'text' },
    lastActivityAt: { column: 'last_activity_at', type: 'timestamp' },
    nextTask: { column: 'next_task', type: 'text' },
    rating: { column: 'rating', type: 'int' },
    notes: { column: 'notes', type: 'text' },
    ...timestamps,
  },
};

const vehicleSchema: TableSchema = {
  table: 'vehicles',
  idPrefix: 'veh',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    propertyId: { column: 'property_id', type: 'text' },
    make: { column: 'make', type: 'text' },
    model: { column: 'model', type: 'text' },
    year: { column: 'year', type: 'int' },
    plate: { column: 'plate', type: 'text' },
    kind: { column: 'kind', type: 'text' },
    mileageKm: { column: 'mileage_km', type: 'int' },
    serviceIntervalKm: { column: 'service_interval_km', type: 'int' },
    lastServiceAt: { column: 'last_service_at', type: 'timestamp' },
    nextServiceAt: { column: 'next_service_at', type: 'timestamp' },
    nextServiceKm: { column: 'next_service_km', type: 'int' },
    insuranceProvider: { column: 'insurance_provider', type: 'text' },
    insuranceStatus: { column: 'insurance_status', type: 'text' },
    insuranceExpiresAt: { column: 'insurance_expires_at', type: 'timestamp' },
    location: { column: 'location', type: 'text' },
    assignedDriverId: { column: 'assigned_driver_id', type: 'text' },
    status: { column: 'status', type: 'text' },
    fuelLevelPct: { column: 'fuel_level_pct', type: 'int' },
    notes: { column: 'notes', type: 'text' },
    ...timestamps,
  },
};

const tripSchema: TableSchema = {
  table: 'trips',
  idPrefix: 'trip',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    title: { column: 'title', type: 'text' },
    originCity: { column: 'origin_city', type: 'text' },
    destinationCity: { column: 'destination_city', type: 'text' },
    propertyId: { column: 'property_id', type: 'text' },
    startsAt: { column: 'starts_at', type: 'timestamp' },
    endsAt: { column: 'ends_at', type: 'timestamp' },
    mode: { column: 'mode', type: 'text' },
    status: { column: 'status', type: 'text' },
    travelers: { column: 'travelers', type: 'int' },
    notes: { column: 'notes', type: 'text' },
    ...timestamps,
  },
};

const tripLegSchema: TableSchema = {
  table: 'trip_legs',
  idPrefix: 'leg',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    tripId: { column: 'trip_id', type: 'text' },
    position: { column: 'position', type: 'int' },
    kind: { column: 'kind', type: 'text' },
    label: { column: 'label', type: 'text' },
    detail: { column: 'detail', type: 'text' },
    at: { column: 'at', type: 'timestamp' },
    provider: { column: 'provider', type: 'text' },
    reference: { column: 'reference', type: 'text' },
    status: { column: 'status', type: 'text' },
  },
};

const taskSchema: TableSchema = {
  table: 'tasks',
  idPrefix: 'tsk',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    propertyId: { column: 'property_id', type: 'text' },
    staffId: { column: 'staff_id', type: 'text' },
    title: { column: 'title', type: 'text' },
    category: { column: 'category', type: 'text' },
    status: { column: 'status', type: 'text' },
    priority: { column: 'priority', type: 'text' },
    dueAt: { column: 'due_at', type: 'timestamp' },
    completedAt: { column: 'completed_at', type: 'timestamp' },
    origin: { column: 'origin', type: 'text' },
    originRef: { column: 'origin_ref', type: 'text' },
    requiresConfirmation: { column: 'requires_confirmation', type: 'bool' },
    detail: { column: 'detail', type: 'text' },
    ...timestamps,
  },
};

const expenseSchema: TableSchema = {
  table: 'expenses',
  idPrefix: 'exp',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    propertyId: { column: 'property_id', type: 'text' },
    categoryKey: { column: 'category_key', type: 'text' },
    description: { column: 'description', type: 'text' },
    vendor: { column: 'vendor', type: 'text' },
    amountCents: { column: 'amount_cents', type: 'int' },
    spentOn: { column: 'spent_on', type: 'text' },
    status: { column: 'status', type: 'text' },
    requiresReview: { column: 'requires_review', type: 'bool' },
    notes: { column: 'notes', type: 'text' },
    createdAt: { column: 'created_at', type: 'text', writable: false },
  },
};

const documentSchema: TableSchema = {
  table: 'documents',
  idPrefix: 'doc',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    propertyId: { column: 'property_id', type: 'text' },
    name: { column: 'name', type: 'text' },
    category: { column: 'category', type: 'text' },
    fileType: { column: 'file_type', type: 'text' },
    sizeKb: { column: 'size_kb', type: 'int' },
    version: { column: 'version', type: 'int' },
    owner: { column: 'owner', type: 'text' },
    tags: { column: 'tags', type: 'json' },
    visibility: { column: 'visibility', type: 'text' },
    status: { column: 'status', type: 'text' },
    expiresAt: { column: 'expires_at', type: 'timestamp' },
    uploadedAt: { column: 'uploaded_at', type: 'timestamp' },
    notes: { column: 'notes', type: 'text' },
    storedPath: { column: 'stored_path', type: 'text' },
    updatedAt: { column: 'updated_at', type: 'text', writable: false },
  },
};

const reservationSchema: TableSchema = {
  table: 'reservations',
  idPrefix: 'res',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    propertyId: { column: 'property_id', type: 'text' },
    kind: { column: 'kind', type: 'text' },
    title: { column: 'title', type: 'text' },
    vendor: { column: 'vendor', type: 'text' },
    city: { column: 'city', type: 'text' },
    startsAt: { column: 'starts_at', type: 'timestamp' },
    guests: { column: 'guests', type: 'int' },
    status: { column: 'status', type: 'text' },
    reference: { column: 'reference', type: 'text' },
    dressCode: { column: 'dress_code', type: 'text' },
    notes: { column: 'notes', type: 'text' },
    ...timestamps,
  },
};

const notificationSchema: TableSchema = {
  table: 'notifications',
  idPrefix: 'ntf',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    kind: { column: 'kind', type: 'text' },
    title: { column: 'title', type: 'text' },
    body: { column: 'body', type: 'text' },
    severity: { column: 'severity', type: 'text' },
    actionLabel: { column: 'action_label', type: 'text' },
    actionHref: { column: 'action_href', type: 'text' },
    readAt: { column: 'read_at', type: 'timestamp' },
    createdAt: { column: 'created_at', type: 'text', writable: false },
  },
};

const aiTaskSchema: TableSchema = {
  table: 'ai_tasks',
  idPrefix: 'ait',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    conversationId: { column: 'conversation_id', type: 'text' },
    label: { column: 'label', type: 'text' },
    module: { column: 'module', type: 'text' },
    status: { column: 'status', type: 'text' },
    requiresConfirmation: { column: 'requires_confirmation', type: 'bool' },
    confidence: { column: 'confidence', type: 'real' },
    detail: { column: 'detail', type: 'text' },
    taskId: { column: 'task_id', type: 'text' },
    ...timestamps,
  },
};

const subscriptionSchema: TableSchema = {
  table: 'subscriptions',
  idPrefix: 'sub',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    plan: { column: 'plan', type: 'text' },
    status: { column: 'status', type: 'text' },
    billingCycle: { column: 'billing_cycle', type: 'text' },
    amountCents: { column: 'amount_cents', type: 'int' },
    currency: { column: 'currency', type: 'text' },
    provider: { column: 'provider', type: 'text' },
    providerCustomerId: { column: 'provider_customer_id', type: 'text' },
    providerSubscriptionId: { column: 'provider_subscription_id', type: 'text' },
    currentPeriodEnd: { column: 'current_period_end', type: 'timestamp' },
    cancelAtPeriodEnd: { column: 'cancel_at_period_end', type: 'bool' },
    startedAt: { column: 'started_at', type: 'timestamp', writable: false },
    cancelledAt: { column: 'cancelled_at', type: 'timestamp' },
    updatedAt: { column: 'updated_at', type: 'text', writable: false },
  },
};

const invoiceSchema: TableSchema = {
  table: 'invoices',
  idPrefix: 'inv',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    subscriptionId: { column: 'subscription_id', type: 'text' },
    number: { column: 'number', type: 'text' },
    description: { column: 'description', type: 'text' },
    amountCents: { column: 'amount_cents', type: 'int' },
    currency: { column: 'currency', type: 'text' },
    status: { column: 'status', type: 'text' },
    issuedAt: { column: 'issued_at', type: 'timestamp' },
    paidAt: { column: 'paid_at', type: 'timestamp' },
    receiptUrl: { column: 'receipt_url', type: 'text' },
  },
};

const accessRequestSchema: TableSchema = {
  table: 'access_requests',
  idPrefix: 'areq',
  columns: {
    id: common.id,
    firstName: { column: 'first_name', type: 'text' },
    lastName: { column: 'last_name', type: 'text' },
    email: { column: 'email', type: 'text' },
    country: { column: 'country', type: 'text' },
    residences: { column: 'residences', type: 'int' },
    primaryRequirement: { column: 'primary_requirement', type: 'text' },
    message: { column: 'message', type: 'text' },
    referrer: { column: 'referrer', type: 'text' },
    status: { column: 'status', type: 'text' },
    reviewerNote: { column: 'reviewer_note', type: 'text' },
    ...timestamps,
  },
};

const ticketSchema: TableSchema = {
  table: 'tickets',
  idPrefix: 'tkt',
  tenantColumn: 'user_id',
  columns: {
    ...common,
    subject: { column: 'subject', type: 'text' },
    body: { column: 'body', type: 'text' },
    priority: { column: 'priority', type: 'text' },
    status: { column: 'status', type: 'text' },
    assignee: { column: 'assignee', type: 'text' },
    reply: { column: 'reply', type: 'text' },
    ...timestamps,
  },
};

/* ------------------------------------------------------------ exports */

export const propertiesTable = new Table<PropertyRow>(propertySchema);
export const staffTable = new Table<StaffRow>(staffSchema);
export const vehiclesTable = new Table<VehicleRow>(vehicleSchema);
export const tripsTable = new Table<TripRow>(tripSchema);
export const tripLegsTable = new Table<TripLegRow>(tripLegSchema);
export const tasksTable = new Table<TaskRow>(taskSchema);
export const expensesTable = new Table<ExpenseRow>(expenseSchema);
export const documentsTable = new Table<DocumentRow>(documentSchema);
export const reservationsTable = new Table<ReservationRow>(reservationSchema);
export const notificationsTable = new Table<NotificationRow>(notificationSchema);
export const aiTasksTable = new Table<AiTaskRow>(aiTaskSchema);
export const subscriptionsTable = new Table<SubscriptionRow>(subscriptionSchema);
export const invoicesTable = new Table<InvoiceRow>(invoiceSchema);
export const accessRequestsTable = new Table<AccessRequestRow>(accessRequestSchema);
export const ticketsTable = new Table<TicketRow>(ticketSchema);

/**
 * Input validation — the single gate in front of the database.
 *
 * Every field is explicitly allowed here; unknown keys are stripped
 * (`.strip()` is zod's default) so a crafted payload cannot inject columns.
 * Enum values mirror the CHECK constraints in db/schema.sql, which turns a
 * would-be SQL error into a readable 422 on the form.
 */
import { z } from 'zod';
import {
  DOCUMENT_CATEGORIES,
  PROPERTY_KINDS,
  PROPERTY_STATUS,
  RESERVATION_KINDS,
  RESERVATION_STATUS,
  STAFF_ROLES,
  STAFF_STATUS,
  TASK_CATEGORIES,
  TASK_STATUS,
  TRAVEL_MODES,
  TRIP_STATUS,
  VEHICLE_KINDS,
  VEHICLE_STATUS,
  COUNTRIES,
  PRIMARY_REQUIREMENTS,
} from '@/lib/utils/format';
import { PASSWORD_MIN_LENGTH, inspectPassword } from '@/lib/auth/password';

const enumOf = <T extends readonly string[]>(values: T) => z.enum(values as unknown as [T[number], ...T[number][]]);

const trimmed = (max: number, required = true) =>
  z
    .string()
    .trim()
    .min(required ? 1 : 0, 'This field is required.')
    .max(max, `Keep this under ${max} characters.`);

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'An email address is required.')
  .max(160, 'That email address is too long.')
  .email('Enter a valid email address.')
  .transform((v) => v.toLowerCase());

const shortText = (max = 120) => z.string().trim().min(1, 'This field is required.').max(max);
const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(''))
    .transform((v) => (v ? v : null)) as unknown as z.ZodOptional<z.ZodNullable<z.ZodString>>;

const moneyInput = z
  .union([z.string(), z.number()])
  .transform((v): string => (typeof v === 'number' ? String(v) : v))
  .refine((v) => /^-?\d{1,12}([.,]\d{1,2})?$/.test(v.trim()), 'Enter a valid amount, for example 18420 or 1 240,50.')
  .transform((v) => {
    const cleaned = v.replace(/\s/g, '');
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const normalised = lastComma > lastDot ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
    return Math.round(Number(normalised) * 100);
  });

const isoDate = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?)?)?$/, `Enter a valid ${label}.`)
    .transform((v) => {
      const normalised = v.includes('T') || v.includes(' ') ? v.replace(' ', 'T') : `${v}T12:00:00.000Z`;
      const withZone = /Z|[+-]\d{2}:?\d{2}$/.test(normalised) ? normalised : `${normalised}Z`;
      const date = new Date(withZone);
      return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
    });

const optionalIsoDate = (label: string) =>
  z
    .union([isoDate(label), z.literal('').transform(() => null), z.null()])
    .optional()
    .transform((v) => v ?? null) as unknown as z.ZodNullable<z.ZodString>;

const boolish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0']), z.number().int().min(0).max(1)])
  .optional()
  .transform((v) => v === true || v === 'true' || v === 1 || v === '1');

/* ------------------------------------------------------------- accounts */

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.').max(200, 'That password is too long.'),
  remember: boolish,
});

export const registerSchema = z
  .object({
    firstName: shortText(60),
    lastName: shortText(60),
    email: emailSchema,
    password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`).max(200),
    country: z.enum(COUNTRIES as unknown as [string, ...string[]]).optional().or(z.literal('')),
    timezone: z.string().trim().max(60).optional(),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: 'Please confirm the terms to continue.' }) }),
  })
  .superRefine((value, ctx) => {
    const check = inspectPassword(value.password);
    if (!check.ok) {
      for (const message of check.errors) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['password'], message });
      }
    }
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(10, 'This reset link is not valid.').max(200),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`).max(200),
});

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.').max(200),
    next: z.string().min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`).max(200),
    confirm: z.string().max(200),
  })
  .superRefine((value, ctx) => {
    if (value.next !== value.confirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['confirm'], message: 'The two entries do not match.' });
    }
    const check = inspectPassword(value.next);
    if (!check.ok) for (const message of check.errors) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['next'], message });
  });

export const profileSchema = z.object({
  /** Accepted only so the route can refuse it explicitly; the address is not editable here. */
  email: z.unknown().optional(),
  firstName: shortText(60),
  lastName: shortText(60),
  country: z.enum(COUNTRIES as unknown as [string, ...string[]]).optional().or(z.literal('')),
  timezone: z.string().trim().min(1).max(60),
  locale: z.enum(['en-GB', 'fr-FR', 'de-DE', 'it-IT', 'es-ES', 'ar-AE', 'ja-JP']).optional(),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF', 'AED']).optional(),
  briefingTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time.'),
});

const preferenceFlag = z.union([z.boolean(), z.enum(['true', 'false', '1', '0']), z.number().int().min(0).max(1)]);
const preferenceFlags = z.object({
  daily_briefing: preferenceFlag.optional(),
  property_alerts: preferenceFlag.optional(),
  travel_updates: preferenceFlag.optional(),
  expense_review: preferenceFlag.optional(),
  staff_requests: preferenceFlag.optional(),
  channel: z.enum(['in_app', 'in_app_and_email', 'email']).optional(),
});

/**
 * Preferences may arrive flat (what the settings form sends) or wrapped in
 * `preferences` (what GET returns) — both are accepted, and a field that is
 * simply absent keeps its stored value instead of being switched off.
 */
export const preferencesPatchSchema = z.object({
  ...preferenceFlags.shape,
  preferences: preferenceFlags.optional(),
  briefingTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a valid time.')
    .optional(),
});

export const preferencesSchema = z.object({
  daily_briefing: boolish,
  property_alerts: boolish,
  travel_updates: boolish,
  expense_review: boolish,
  staff_requests: boolish,
  channel: z.enum(['in_app', 'in_app_and_email', 'email']).optional(),
});

/* ------------------------------------------------------------ modules */

export const propertyCreateSchema = z.object({
  name: shortText(80),
  city: shortText(60),
  country: shortText(60),
  kind: enumOf(PROPERTY_KINDS).default('residence'),
  status: enumOf(PROPERTY_STATUS).default('operational'),
  isPrimary: boolish,
  bedrooms: z.coerce.number().int().min(0).max(80).optional().default(0),
  bathrooms: z.coerce.number().int().min(0).max(80).optional().default(0),
  areaSqm: z.coerce.number().int().min(0).max(50000).optional().default(0),
  temperatureC: z.coerce.number().min(-40).max(60).optional().nullable(),
  nextServiceAt: optionalIsoDate('service date'),
  monthlyOpsCents: moneyInput.optional().default(0),
  notes: trimmed(1200, false).optional().nullable(),
});

export const propertyUpdateSchema = propertyCreateSchema.partial().extend({
  staffOnSite: z.coerce.number().int().min(0).max(200).optional(),
  lastMaintenanceAt: optionalIsoDate('maintenance date'),
  accent: enumOf(['gold', 'ivory', 'graphite', 'sage', 'steel'] as const).optional(),
});

export const staffCreateSchema = z.object({
  firstName: shortText(60),
  lastName: shortText(60),
  role: enumOf(STAFF_ROLES),
  status: enumOf(STAFF_STATUS).default('available'),
  employment: enumOf(['full_time', 'part_time', 'daily', 'agency', 'on_call'] as const).default('full_time'),
  propertyId: z.string().trim().max(60).optional().nullable(),
  email: z.string().trim().email('Enter a valid email address.').max(160).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  languages: z.array(z.string().trim().min(1).max(30)).max(8).optional().default([]),
  nextTask: trimmed(200, false).optional().nullable(),
  lastActivity: trimmed(200, false).optional().nullable(),
  notes: trimmed(800, false).optional().nullable(),
});
export const staffUpdateSchema = staffCreateSchema.partial();

export const vehicleCreateSchema = z.object({
  make: shortText(40),
  model: shortText(60),
  year: z.coerce.number().int().min(1950).max(2100),
  plate: trimmed(24, false).optional().nullable(),
  kind: enumOf(VEHICLE_KINDS).default('suv'),
  status: enumOf(VEHICLE_STATUS).default('ready'),
  propertyId: z.string().trim().max(60).optional().nullable(),
  mileageKm: z.coerce.number().int().min(0).max(2_000_000).optional().default(0),
  nextServiceAt: optionalIsoDate('service date'),
  nextServiceKm: z.coerce.number().int().min(0).max(2_000_000).optional().nullable(),
  insuranceStatus: enumOf(['active', 'expiring', 'expired', 'pending'] as const).default('active'),
  insuranceProvider: trimmed(80, false).optional().nullable(),
  insuranceExpiresAt: optionalIsoDate('insurance expiry'),
  location: trimmed(120, false).optional().nullable(),
  assignedDriverId: z.string().trim().max(60).optional().nullable(),
  fuelLevelPct: z.coerce.number().int().min(0).max(100).optional().nullable(),
  notes: trimmed(800, false).optional().nullable(),
});
export const vehicleUpdateSchema = vehicleCreateSchema.partial().extend({
  logMileage: z.coerce.number().int().min(0).max(500_000).optional(),
});

/** One step of a journey: the transfer, the handling, the dinner, the ready house. */
const tripLegSchema = z.object({
  kind: enumOf(['transfer', 'flight', 'train', 'arrival', 'house', 'dinner', 'meeting', 'departure'] as const).default('transfer'),
  label: shortText(90),
  detail: trimmed(200, false).optional().nullable(),
  at: optionalIsoDate('time').optional().nullable(),
  provider: trimmed(80, false).optional().nullable(),
  reference: trimmed(40, false).optional().nullable(),
  status: enumOf(['pending', 'requested', 'confirmed', 'cancelled'] as const).default('pending'),
});

export const tripCreateSchema = z.object({
  title: shortText(90),
  originCity: shortText(60),
  destinationCity: shortText(60),
  propertyId: z.string().trim().max(60).optional().nullable(),
  startsAt: isoDate('departure date and time'),
  endsAt: optionalIsoDate('return date'),
  mode: enumOf(TRAVEL_MODES).default('car'),
  status: enumOf(TRIP_STATUS).default('pending'),
  travelers: z.coerce.number().int().min(1).max(40).optional().default(1),
  notes: trimmed(800, false).optional().nullable(),
  /** The arrival plan. Sent with the journey so the office never loses a step. */
  legs: z.array(tripLegSchema).max(12, 'Twelve steps is plenty for one journey.').optional(),
});
export const tripUpdateSchema = tripCreateSchema.partial();

export const tripLegStatusSchema = z.object({
  status: enumOf(['pending', 'requested', 'confirmed', 'cancelled'] as const),
});

export const taskCreateSchema = z.object({
  title: shortText(160),
  category: enumOf(TASK_CATEGORIES).default('maintenance'),
  status: enumOf(TASK_STATUS).default('pending'),
  priority: enumOf(['low', 'normal', 'high', 'critical'] as const).default('normal'),
  propertyId: z.string().trim().max(60).optional().nullable(),
  staffId: z.string().trim().max(60).optional().nullable(),
  dueAt: optionalIsoDate('due date'),
  detail: trimmed(1200, false).optional().nullable(),
  requiresConfirmation: boolish,
});
export const taskUpdateSchema = taskCreateSchema.partial();

export const expenseCreateSchema = z.object({
  categoryKey: enumOf(['property_operations', 'staff', 'vehicles', 'travel', 'lifestyle', 'advisers'] as const),
  description: shortText(160),
  vendor: trimmed(90, false).optional().nullable(),
  amount: moneyInput.refine((cents) => cents !== 0, 'Enter an amount.'),
  spentOn: isoDate('date'),
  propertyId: z.string().trim().max(60).optional().nullable(),
  status: enumOf(['recorded', 'pending', 'approved', 'disputed'] as const).default('recorded'),
  notes: trimmed(600, false).optional().nullable(),
});

export const documentCreateSchema = z.object({
  name: shortText(160),
  category: enumOf(DOCUMENT_CATEGORIES),
  propertyId: z.string().trim().max(60).optional().nullable(),
  fileType: trimmed(10, false).optional().default('pdf'),
  sizeKb: z.coerce.number().int().min(0).max(5_000_000).optional().default(0),
  owner: trimmed(80, false).optional().nullable(),
  visibility: enumOf(['private', 'household', 'advisers'] as const).default('private'),
  status: enumOf(['valid', 'expiring', 'expired', 'draft'] as const).default('valid'),
  expiresAt: optionalIsoDate('expiry date'),
  tags: z.array(trimmed(24)).max(8).optional().default([]),
  notes: trimmed(600, false).optional().nullable(),
  /** written by the upload endpoint only; a client cannot point a record at an arbitrary path */
  storedPath: z.string().trim().max(200).optional().nullable(),
});
export const documentUpdateSchema = documentCreateSchema.partial();

/** What the multipart upload endpoint accepts alongside the file itself. */
export const documentUploadSchema = z.object({
  name: shortText(160),
  category: enumOf(DOCUMENT_CATEGORIES),
  propertyId: z.string().trim().max(60).optional().nullable(),
  owner: trimmed(80, false).optional().nullable(),
  visibility: enumOf(['private', 'household', 'advisers'] as const).default('private'),
  expiresAt: optionalIsoDate('expiry date').optional().nullable(),
  tags: z.array(trimmed(24)).max(8).optional().default([]),
  notes: trimmed(600, false).optional().nullable(),
});

export const reservationCreateSchema = z.object({
  title: shortText(120),
  kind: enumOf(RESERVATION_KINDS).default('restaurant'),
  vendor: trimmed(90, false).optional().nullable(),
  city: trimmed(60, false).optional().nullable(),
  startsAt: optionalIsoDate('date and time'),
  guests: z.coerce.number().int().min(1).max(400).optional().default(2),
  status: enumOf(RESERVATION_STATUS).default('requested'),
  reference: trimmed(40, false).optional().nullable(),
  dressCode: trimmed(60, false).optional().nullable(),
  notes: trimmed(600, false).optional().nullable(),
  propertyId: z.string().trim().max(60).optional().nullable(),
});
export const reservationUpdateSchema = reservationCreateSchema.partial();

/* -------------------------------------------------------------- AI */

export const aiRequestSchema = z.object({
  request: trimmed(900).max(600, 'Keep requests under 600 characters.'),
  conversationId: z.string().trim().max(60).optional().nullable(),
});

export const aiActionSchema = z.object({
  aiTaskId: z.string().trim().min(1),
  decision: z.enum(['confirm', 'decline', 'defer']),
});

export const searchSchema = z.object({
  q: z.string().trim().max(120).default(''),
  scope: z.enum(['all', 'properties', 'people', 'documents', 'tasks', 'travel']).default('all'),
});

/* --------------------------------------------------------- marketing */

export const accessRequestSchema = z.object({
  firstName: shortText(60),
  lastName: shortText(60),
  email: emailSchema,
  country: z.enum(COUNTRIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'Select a country of residence.' }),
  }),
  residences: z.coerce
    .number()
    .int('Enter a whole number.')
    .min(1, 'At least one residence.')
    .max(99, 'For more than 99 residences, please write to your adviser directly.'),
  primaryRequirement: z.enum(PRIMARY_REQUIREMENTS as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'Select what matters most.' }),
  }),
  message: trimmed(1400, false).optional().nullable(),
  /** honeypot: must stay empty */
  website: z.string().max(0, 'Spam detected.').optional(),
});

export const membershipActionSchema = z.object({
  plan: enumOf(['private', 'priority', 'private_office'] as const),
  billingCycle: enumOf(['monthly', 'annual'] as const).default('monthly'),
  /**
   * `checkout` is Stripe's hosted page (card and anything else the operator
   * enabled). `transfer` opens an invoice with a due date instead — a transfer is
   * initiated by the payer, so it can only ever pay a period in advance.
   */
  method: enumOf(['checkout', 'transfer'] as const).default('checkout'),
});

export const ticketSchema = z.object({
  subject: shortText(120),
  body: trimmed(1600).optional().nullable(),
  priority: enumOf(['low', 'normal', 'high', 'urgent'] as const).default('normal'),
});

/* ------------------------------------------------------------- admin */

export const adminUserUpdateSchema = z.object({
  role: enumOf(['owner', 'admin'] as const).optional(),
  status: enumOf(['active', 'invited', 'suspended'] as const).optional(),
});

export const adminAccessRequestSchema = z.object({
  status: enumOf(['new', 'reviewing', 'invited', 'declined', 'archived'] as const),
  reviewerNote: trimmed(600, false).optional().nullable(),
});

export const adminTicketSchema = z.object({
  status: enumOf(['open', 'in_review', 'answered', 'closed'] as const),
  reply: trimmed(1600, false).optional().nullable(),
  assignee: trimmed(80, false).optional().nullable(),
});

/* -------------------------------------------------------- query params */

export const listQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().trim().max(30).optional(),
  role: z.string().trim().max(30).optional(),
  category: z.string().trim().max(30).optional(),
  propertyId: z.string().trim().max(60).optional(),
  sort: z.enum(['recent', 'name', 'due', 'amount', 'status']).default('recent'),
  month: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}$/, 'Invalid month.')
    .optional(),
});

export type AccessRequestInput = z.infer<typeof accessRequestSchema>;
export type PropertyCreateInput = z.infer<typeof propertyCreateSchema>;
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export type TripCreateInput = z.infer<typeof tripCreateSchema>;
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;
export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>;
export type VehicleCreateInput = z.infer<typeof vehicleCreateSchema>;
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;
export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;

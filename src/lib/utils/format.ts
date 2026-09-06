import clsx, { type ClassValue } from 'clsx';

/** VELORA PRIVATE — product constants, labels and formatting. No secrets, no env reads here. */

export type PlanKey = 'private' | 'priority' | 'private_office';

export interface MembershipPlan {
  key: PlanKey;
  name: string;
  positioning: string;
  price_cents_monthly: number;
  price_label: string;
  annual_discount_pct: number;
  residences_included: number;
  staff_directory_limit: number | null;
  ai_requests_per_day: number | 'unlimited';
  response_sla: string;
  human_concierge: string;
  features: string[];
  /** Optional Stripe Price id — read from env so codes never live in the UI. */
  stripe_price_env?: string;
  featured?: boolean;
}

/* ============================================================
   PRICES — edit here. One place, used by /membership, the API,
   the admin console and the billing adapters.
   ============================================================ */
export const MEMBERSHIP_PLANS: readonly MembershipPlan[] = [
  {
    key: 'private',
    name: 'PRIVATE',
    positioning: 'A single residence, quietly organised.',
    price_cents_monthly: 19_900,
    price_label: '€199',
    annual_discount_pct: 10,
    residences_included: 1,
    staff_directory_limit: 12,
    ai_requests_per_day: 40,
    response_sla: 'Next business day',
    human_concierge: 'Email concierge',
    features: [
      'One residence, one household directory',
      'Tasks, staff and supplier records',
      'Travel timeline and document library',
      'VELORA AI — 40 requests per day',
      'Daily briefing at a fixed hour',
    ],
    stripe_price_env: 'STRIPE_PRICE_PRIVATE',
  },
  {
    key: 'priority',
    name: 'PRIORITY',
    positioning: 'Several residences, one command centre.',
    price_cents_monthly: 49_900,
    price_label: '€499',
    annual_discount_pct: 12,
    residences_included: 4,
    staff_directory_limit: 60,
    ai_requests_per_day: 250,
    response_sla: 'Within 4 hours',
    human_concierge: 'Named estate coordinator',
    features: [
      'Up to four residences',
      'Vehicles, fuel, insurance and service tracking',
      'Expenditure ledger by residence and category',
      'AI command centre with task drafting',
      'Staff assignments and confirmations',
      'Priority request queue',
    ],
    stripe_price_env: 'STRIPE_PRICE_PRIORITY',
    featured: true,
  },
  {
    key: 'private_office',
    name: 'PRIVATE OFFICE',
    positioning: 'A full private office, digitally staffed.',
    price_cents_monthly: 150_000,
    price_label: '€1,500+',
    annual_discount_pct: 0,
    residences_included: 99,
    staff_directory_limit: null,
    ai_requests_per_day: 'unlimited',
    response_sla: 'Within 30 minutes, 07:00–23:00',
    human_concierge: 'Dedicated team of three',
    features: [
      'Unlimited residences and households',
      'Dedicated estate coordinator and analyst',
      'Family-office reporting pack, monthly',
      'Supplier contracting and invoice control',
      'Travel desk with aviation and ground handling',
      'Discreet onboarding of your existing advisers',
      'Custom integrations and data export',
    ],
    stripe_price_env: 'STRIPE_PRICE_PRIVATE_OFFICE',
  },
] as const;

export const PLAN_BY_KEY = Object.fromEntries(MEMBERSHIP_PLANS.map((p) => [p.key, p])) as Record<PlanKey, MembershipPlan>;

export function getPlan(key: string | null | undefined): MembershipPlan {
  return PLAN_BY_KEY[(key ?? 'private') as PlanKey] ?? MEMBERSHIP_PLANS[0];
}

/* -------------------------------------------------------------- modules */

export interface AppModule {
  key: string;
  label: string;
  route: string;
  blurb: string;
  detail: string;
}

export const APP_MODULES: readonly AppModule[] = [
  { key: 'property', label: 'Property', route: '/properties', blurb: 'Residences, condition, budgets.', detail: 'Every residence, its condition, its people and its budget in one ledger.' },
  { key: 'people', label: 'People', route: '/people', blurb: 'Staff, assistants, providers.', detail: 'A staff directory with roles, status, last activity and what each person owes next.' },
  { key: 'travel', label: 'Travel', route: '/travel', blurb: 'Movements and arrivals.', detail: 'Journeys as timelines: transfers, handling, arrivals, residence readiness.' },
  { key: 'lifestyle', label: 'Lifestyle', route: '/lifestyle', blurb: 'Reservations and access.', detail: 'Requests and reservations with clear status — never a false confirmation.' },
  { key: 'finance', label: 'Finance', route: '/finance', blurb: 'Spend and commitments.', detail: 'Recorded expenditure by residence and category. Organisation, not advice.' },
  { key: 'intelligence', label: 'Intelligence', route: '/ai', blurb: 'Your personal assistant.', detail: 'One sentence in, a coordinated set of tasks out.' },
];

export const PROPERTY_KINDS = ['residence', 'apartment', 'villa', 'chalet', 'estate', 'penthouse', 'townhouse'] as const;
export const PROPERTY_STATUS = ['operational', 'attention', 'maintenance', 'standby'] as const;
export const STAFF_ROLES = [
  'estate_manager',
  'housekeeper',
  'driver',
  'security',
  'chef',
  'maintenance',
  'personal_assistant',
  'gardener',
  'butler',
  'nanny',
] as const;
export const STAFF_STATUS = ['on_site', 'available', 'off_duty', 'on_leave', 'unreachable'] as const;
export const TASK_CATEGORIES = ['maintenance', 'housekeeping', 'travel', 'security', 'lifestyle', 'finance', 'staff', 'vehicles'] as const;
export const TASK_STATUS = ['pending', 'in_progress', 'awaiting_confirmation', 'done', 'blocked'] as const;
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  property_operations: 'Property operations',
  staff: 'Staff',
  vehicles: 'Vehicles',
  travel: 'Travel',
  lifestyle: 'Lifestyle',
  advisers: 'Advisers & insurance',
};
export const DOCUMENT_CATEGORIES = ['contracts', 'invoices', 'insurance', 'real_estate', 'maintenance', 'suppliers', 'identity', 'vehicles'] as const;
export const VEHICLE_KINDS = ['suv', 'gt', 'sedan', 'van', 'sport', 'limousine', 'cabriolet'] as const;
export const VEHICLE_STATUS = ['ready', 'in_use', 'in_service', 'stored', 'unavailable'] as const;
export const TRAVEL_MODES = ['car', 'road', 'train', 'flight', 'jet', 'helicopter', 'boat'] as const;
export const TRIP_STATUS = ['draft', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'] as const;
export const RESERVATION_KINDS = ['restaurant', 'event', 'experience', 'yacht', 'spa', 'retail', 'aviation', 'club'] as const;
export const RESERVATION_STATUS = ['requested', 'pending', 'confirmed', 'completed', 'cancelled', 'unavailable'] as const;

/** Country list for the access form — long enough to feel real, short enough to scan. */
export const COUNTRIES = [
  'France',
  'Monaco',
  'Switzerland',
  'United Kingdom',
  'Luxembourg',
  'Liechtenstein',
  'Belgium',
  'Netherlands',
  'Germany',
  'Italy',
  'Spain',
  'Portugal',
  'Austria',
  'Sweden',
  'Norway',
  'Denmark',
  'Ireland',
  'Greece',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Singapore',
  'Hong Kong S.A.R.',
  'Japan',
  'India',
  'United States',
  'Canada',
  'Brazil',
  'Mexico',
  'South Africa',
  'Australia',
  'New Zealand',
  'Other',
] as const;

export const PRIMARY_REQUIREMENTS = [
  'Property operations',
  'Staff & household management',
  'Travel & aviation',
  'Lifestyle & reservations',
  'Consolidated expenditure tracking',
  'Document & contract control',
  'Family office reporting',
  'Something else',
] as const;

/* --------------------------------------------------------------- labels */

export const STATUS_LABEL: Record<string, string> = {
  operational: 'Operational',
  attention: 'Attention',
  maintenance: 'Under maintenance',
  standby: 'Standby',
  on_site: 'On site',
  available: 'Available',
  off_duty: 'Off duty',
  on_leave: 'On leave',
  unreachable: 'Unreachable',
  pending: 'Pending',
  in_progress: 'In progress',
  awaiting_confirmation: 'Awaiting your confirmation',
  done: 'Complete',
  blocked: 'Blocked',
  ready: 'Ready',
  in_use: 'In use',
  in_service: 'In service',
  stored: 'Stored',
  unavailable: 'Unavailable',
  confirmed: 'Confirmed',
  requested: 'Requested',
  completed: 'Completed',
  cancelled: 'Cancelled',
  draft: 'Draft',
  valid: 'Valid',
  expiring: 'Expiring soon',
  expired: 'Expired',
  active: 'Active',
  past_due: 'Past due',
  trialing: 'Trial',
  paused: 'Paused',
  cancelled_sub: 'Cancelled',
  recorded: 'Recorded',
  approved: 'Approved',
  disputed: 'Disputed',
  requires_confirmation: 'Requires confirmation',
  proposed: 'Proposed',
};

export const ROLE_LABEL: Record<string, string> = {
  estate_manager: 'Estate Manager',
  housekeeper: 'Housekeeper',
  driver: 'Driver',
  security: 'Security',
  chef: 'Chef',
  maintenance: 'Maintenance',
  personal_assistant: 'Personal Assistant',
  gardener: 'Gardener',
  butler: 'Butler',
  nanny: 'Nanny',
};

export function label(value: string | null | undefined, map: Record<string, string>): string {
  if (!value) return '—';
  return map[value] ?? value.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/* ---------------------------------------------------------------- money */

export function formatMoney(cents: number | null | undefined, opts: { currency?: string; compact?: boolean; sign?: boolean } = {}): string {
  const currency = opts.currency ?? 'EUR';
  const value = Number(cents ?? 0) / 100;
  const nf = new Intl.NumberFormat(currency === 'EUR' ? 'fr-FR' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    notation: opts.compact ? 'compact' : 'standard',
  });
  const out = nf.format(Math.abs(value));
  if (value < 0) return `−${out}`;
  return opts.sign ? `+${out}` : out;
}

export function formatNumber(n: number | null | undefined, opts: Intl.NumberFormatOptions = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1, ...opts }).format(n);
}

export function parseAmountToCents(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = input.replace(/[\s\u00a0]/g, '').replace(/[^\d.,-]/g, '');
  if (!cleaned) return 0;
  // European "1.234,56" and Anglo "1,234.56" both accepted.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalised = cleaned;
  if (lastComma > lastDot) {
    normalised = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalised = cleaned.replace(/,/g, '');
  }
  const n = Number(normalised);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/* ---------------------------------------------------------------- dates */

export function formatDate(iso: string | null | undefined, style: 'long' | 'medium' | 'short' | 'day' | 'month' = 'medium', timeZone?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { day: 'numeric', month: 'long', year: 'numeric' }
      : style === 'day'
        ? { weekday: 'short', day: 'numeric', month: 'short' }
        : style === 'month'
          ? { month: 'long', year: 'numeric' }
          : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: timeZone ?? 'UTC' }).format(d);
}

export function formatTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timeZone ?? 'UTC' }).format(d);
}

export function formatDateTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return '—';
  const t = formatTime(iso, timeZone);
  const d = formatDate(iso, 'medium', timeZone);
  return t ? `${d} · ${t}` : d;
}

export function relativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '—';
  const diffMs = then.getTime() - now.getTime();
  const abs = Math.abs(diffMs);
  const min = Math.round(abs / 60000);
  const unit = (value: number, u: string) => `${value} ${u}${value === 1 ? '' : 's'}`;
  let text: string;
  if (min < 1) text = 'moments';
  else if (min < 60) text = unit(min, 'minute');
  else if (min < 60 * 24) text = unit(Math.round(min / 60), 'hour');
  else if (min < 60 * 24 * 30) text = unit(Math.round(min / (60 * 24)), 'day');
  else if (min < 60 * 24 * 365) text = unit(Math.round(min / (60 * 24 * 30)), 'month');
  else text = unit(Math.round(min / (60 * 24 * 365)), 'year');
  if (min < 1) return 'just now';
  return diffMs >= 0 ? `in ${text}` : `${text} ago`;
}

export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.ceil((then.getTime() - now.getTime()) / 86_400_000);
}

export function monthKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening'; // overnight — never "good morning" at 03:00
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/* -------------------------------------------------------------- classes */

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function initialsOf(first?: string | null, last?: string | null, fallback = 'VP'): string {
  const a = (first ?? '').trim()[0] ?? '';
  const b = (last ?? '').trim()[0] ?? '';
  const out = `${a}${b}`.toUpperCase();
  return out.length >= 1 ? out : fallback;
}

export function pluralise(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function truncate(text: string, max = 120) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

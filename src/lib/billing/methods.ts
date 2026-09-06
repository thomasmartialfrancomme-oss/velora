/**
 * Which ways of paying this product accepts, and what each one can do.
 *
 * Set `VELORA_PAYMENT_METHODS` to a comma-separated list. Everything is off
 * except card by default, because a payment method that Stripe has not enabled on
 * the account produces a checkout page with a dead option — worse than not
 * offering it. The method must also be switched on in the Stripe Dashboard;
 * this file only decides what the site offers.
 *
 * The classification below is the part that is easy to get wrong and expensive to
 * discover later:
 *  • card and the debit rails can be charged again next period, so they can sell
 *    a monthly subscription;
 *  • a bank transfer is initiated by the payer, which means nothing can be
 *    collected automatically at renewal. Selling a monthly plan that way would
 *    silently produce a lapse every month. So a transfer is offered **only** with
 *    the annual plan, as an invoice with a due date — one payment a year, the way
 *    a household's accounts department actually prefers to pay.
 */
import { billingRuntime } from '@/lib/billing/runtime';

export type MethodId = 'card' | 'sepa_debit' | 'us_bank_account' | 'bacs_debit' | 'ideal' | 'bancontact' | 'blik' | 'swish' | 'bank_transfer';

export interface MethodSpec {
  id: MethodId;
  /** shown to members, in English like every catalogue label — the dictionaries translate it */
  label: string;
  /** what the operator reads in the console */
  adminLabel: string;
  /** can Stripe take the money again next period? */
  recurring: boolean;
  /** 'card' = authorisation, 'debit' = mandate, 'transfer' = payer-initiated */
  kind: 'card' | 'debit' | 'redirect' | 'transfer';
  /** value(s) for Stripe's payment_method_types */
  stripeType: string;
  /** extra payment_method_options Stripe wants for this rail */
  options?: Record<string, Record<string, string>>;
  caveat?: string;
}

export const METHODS: Record<MethodId, MethodSpec> = {
  card: { id: 'card', label: 'Card', adminLabel: 'Cartes (Visa, Mastercard, Amex)', recurring: true, kind: 'card', stripeType: 'card' },
  sepa_debit: {
    id: 'sepa_debit',
    label: 'SEPA direct debit',
    adminLabel: 'Prélèvement SEPA (zone euro)',
    recurring: true,
    kind: 'debit',
    stripeType: 'sepa_debit',
    caveat: 'A mandate is signed at first checkout; renewals then take the money without asking.',
  },
  us_bank_account: {
    id: 'us_bank_account',
    label: 'ACH bank debit',
    adminLabel: 'Prélèvement ACH (États-Unis)',
    recurring: true,
    kind: 'debit',
    stripeType: 'us_bank_account',
    options: { us_bank_account: { verification_method: 'instant' } },
  },
  bacs_debit: { id: 'bacs_debit', label: 'BACS direct debit', adminLabel: 'Prélèvement BACS (Royaume-Uni)', recurring: true, kind: 'debit', stripeType: 'bacs_debit' },
  ideal: { id: 'ideal', label: 'iDEAL', adminLabel: 'iDEAL (Pays-Bas)', recurring: true, kind: 'redirect', stripeType: 'ideal' },
  bancontact: { id: 'bancontact', label: 'Bancontact', adminLabel: 'Bancontact (Belgique)', recurring: true, kind: 'redirect', stripeType: 'bancontact' },
  blik: { id: 'blik', label: 'BLIK', adminLabel: 'BLIK (Pologne)', recurring: false, kind: 'redirect', stripeType: 'blik', caveat: 'One-shot: no recurring charges, so annual invoices only.' },
  swish: { id: 'swish', label: 'Swish', adminLabel: 'Swish (Suède)', recurring: false, kind: 'redirect', stripeType: 'swish' },
  bank_transfer: {
    id: 'bank_transfer',
    label: 'Bank transfer',
    adminLabel: 'Virement bancaire (facture annuelle)',
    recurring: false,
    kind: 'transfer',
    stripeType: 'bank_transfer',
    // No number here on purpose: the due date is operator-set, and this catalogue is
    // built at import time, where reading a configuration that needs the database
    // would be a round trip in the wrong place. The screen shows the real figure.
    caveat: 'Paid against an invoice with a due date. Renewal is a new invoice, never an automatic charge.',
  },
};

export interface MethodPolicy {
  enabled: MethodSpec[];
  /** ids in the environment that this file does not know — reported, never ignored */
  unknown: string[];
  /** the rails that can carry a monthly subscription */
  recurring: MethodSpec[];
  /** everything else, offered on annual only */
  oneOff: MethodSpec[];
}

export function methodPolicy(list?: string): MethodPolicy {
  const requested = (list ?? (billingRuntime().paymentMethods || 'card'))
    .split(',')
    .map((raw) => raw.trim().toLowerCase())
    .filter(Boolean);

  const unknown: string[] = [];
  const enabled: MethodSpec[] = [];
  for (const id of requested) {
    const spec = (METHODS as Record<string, MethodSpec | undefined>)[id];
    if (!spec) unknown.push(id);
    else if (!enabled.some((method) => method.id === spec.id)) enabled.push(spec);
  }
  return {
    enabled,
    unknown,
    recurring: enabled.filter((method) => method.recurring),
    oneOff: enabled.filter((method) => !method.recurring),
  };
}

/** `payment_method_types` for a Checkout session, in the order the payer sees them. */
export function checkoutMethodTypes(policy = methodPolicy()): string[] {
  return policy.enabled.map((method) => method.stripeType);
}

/** `payment_method_options`, merged from whatever the enabled rails need. */
export function checkoutMethodOptions(policy = methodPolicy()): Record<string, Record<string, string>> | undefined {
  const merged: Record<string, Record<string, string>> = {};
  for (const method of policy.enabled) {
    if (method.options) Object.assign(merged, method.options);
  }
  return Object.keys(merged).length ? merged : undefined;
}

/** Does anything here allow a monthly subscription at all? */
export function canSellMonthly(policy = methodPolicy()): boolean {
  return policy.recurring.length > 0;
}

export function methodsSummary(policy = methodPolicy()): string {
  return policy.enabled.map((method) => method.label).join(', ') || 'nothing enabled';
}

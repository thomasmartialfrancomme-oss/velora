#!/usr/bin/env node
/**
 * Wire a Stripe account to this product, once, from the command line.
 *
 *   STRIPE_SECRET_KEY=*** node scripts/stripe-setup.mjs --domain https://your.app
 *
 * What it does, and nothing else:
 *   1. three products (PRIVATE, PRIORITY, PRIVATE OFFICE) with the prices read
 *      from the application's own catalogue — the numbers cannot drift;
 *   2. a monthly and an annual price per plan, EUR, in the same currency the site
 *      quotes;
 *   3. a customer portal configured for plan change and cancellation;
 *   4. a webhook pointing at `<domain>/api/billing/webhook`, and it prints the
 *      signing secret Stripe generates for it.
 * Then it prints the environment lines to paste into Render. It writes nothing to
 * the repository, and it never prints the secret key it was given.
 *
 * What it cannot do, so nobody is surprised: enabling a payment rail (bank transfer,
 * SEPA direct debit) is an agreement between you and Stripe, done in the Dashboard
 * under Settings → Payment methods. No API can accept those terms for you.
 *
 * Options:  --dry-run  (print the calls instead of making them)
 *           --base URL (Stripe API base; used by the test harness)
 *           --no-webhook
 */

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const DRY = flag('dry-run');
const BASE = (opt('base', process.env.STRIPE_API_BASE || 'https://api.stripe.com')).replace(/\/$/, '');
const SECRET = process.env.STRIPE_SECRET_KEY ?? process.env.VELORA_STRIPE_SETUP_KEY ?? '';
const DOMAIN = (opt('domain', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')).replace(/\/$/, '');

if (!SECRET && !DRY) {
  console.error('STRIPE_SECRET_KEY is required (or run with --dry-run to see what would happen).');
  process.exit(2);
}
if (SECRET && !/^sk_(test|live)_/.test(SECRET)) {
  console.error('That does not look like a Stripe secret key (it must start with sk_test_ or sk_live_).');
  process.exit(2);
}

/** The catalogue is read from the source file, so this script and the site cannot disagree. */
function readPlans() {
  const source = readFileSync(path.join(ROOT, 'src/lib/utils/format.ts'), 'utf8');
  const plans = [];
  const block = /key: '([a-z_]+)',\s*\n\s*name: '([^']+)',[\s\S]*?price_cents_monthly: ([\d_]+),[\s\S]*?annual_discount_pct: (\d+)/g;
  for (const match of source.matchAll(block)) {
    plans.push({
      key: match[1],
      name: match[2],
      monthly: Number(match[3].replace(/_/g, '')),
      discountPct: Number(match[4]),
    });
  }
  if (!plans.length) throw new Error('Could not read the plan catalogue out of src/lib/utils/format.ts.');
  return plans;
}

function encode(params, prefix = '') {
  const pairs = [];
  const walk = (value, key) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) return value.forEach((item, index) => walk(item, `${key}[${index}]`));
    if (typeof value === 'object') return Object.entries(value).forEach(([child, inner]) => walk(inner, `${key}[${child}]`));
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(typeof value === 'boolean' ? String(value) : String(value))}`);
  };
  Object.entries(params).forEach(([key, value]) => walk(value, prefix ? `${prefix}[${key}]` : key));
  return pairs.join('&');
}

async function call(method, urlPath, params, label, idempotencyKey) {
  if (DRY) {
    console.log(`  dry-run  ${method} ${urlPath}  ${label ?? ''}`);
    return { id: `${label ? label.slice(0, 3).toLowerCase() : 'obj'}_dryrun`, live_mode: false };
  }
  const response = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: method === 'GET' || method === 'DELETE' ? undefined : encode(params ?? {}),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Stripe answered ${urlPath} with HTTP ${response.status} and a body that is not JSON.`);
  }
  if (!response.ok) {
    const error = json.error ?? {};
    throw new Error(`Stripe refused ${label ?? urlPath}: ${error.message ?? `HTTP ${response.status}`}${error.param ? ` (field: ${error.param})` : ''}`);
  }
  console.log(`  ok       ${label ?? urlPath} → ${json.id ?? 'done'}`);
  return json;
}

console.log(`VELORA · configuration Stripe ${DRY ? '(aperçu)' : `en mode ${SECRET.startsWith('sk_live_') ? 'RÉEL' : 'test'}`}`);
console.log(`  domaine   ${DOMAIN}`);
console.log(`  api       ${BASE === 'https://api.stripe.com' ? 'Stripe' : BASE}`);

const plans = readPlans();
const prices = {};

console.log('\n— produits et prix —');
for (const plan of plans) {
  const product = await call('POST', '/v1/products', { name: `VELORA ${plan.name}`, description: `VELORA PRIVATE · ${plan.name}` }, `produit ${plan.name}`, `velora-product-${plan.key}`);
  const annual = Math.round(plan.monthly * 12 * (1 - plan.discountPct / 100));
  const monthlyPrice = await call(
    'POST',
    '/v1/prices',
    { product: product.id, currency: 'eur', unit_amount: plan.monthly, 'recurring[interval]': 'month', lookup_key: `velora-${plan.key}-monthly`, 'metadata[veloraPlan]': plan.key },
    `prix mensuel ${plan.name} (${(plan.monthly / 100).toFixed(2)} €)`,
    `velora-price-${plan.key}-monthly`,
  );
  const annualPrice = await call(
    'POST',
    '/v1/prices',
    { product: product.id, currency: 'eur', unit_amount: annual, 'recurring[interval]': 'year', lookup_key: `velora-${plan.key}-annual`, 'metadata[veloraPlan]': plan.key },
    `prix annuel ${plan.name} (${(annual / 100).toFixed(2)} €)`,
    `velora-price-${plan.key}-annual`,
  );
  prices[plan.key] = { monthly: monthlyPrice.id, annual: annualPrice.id };
}

console.log('\n— portail client —');
// La forme exacte a été vérifiée contre un compte réel : `return_urls` n'existe pas sur ce
// endpoint (c'est `default_return_url`), et `features[subscription_update][enabled]=true`
// exige la liste des produits — d'où false ci-dessous, la formule se change sur le site.
const PORTAL_NAME = 'VELORA membership';
const portal = await call(
  'POST',
  '/v1/billing_portal/configurations',
  {
    name: PORTAL_NAME,
    'business_profile[headline]': 'Velora — gestion de votre adhésion',
    'business_profile[privacy_policy_url]': `${DOMAIN}/privacy`,
    'business_profile[terms_of_service_url]': `${DOMAIN}/terms`,
    'default_return_url': `${DOMAIN}/membership`,
    'features[invoice_history][enabled]': 'true',
    'features[payment_method_update][enabled]': 'true',
    'features[customer_update][enabled]': 'true',
    'features[customer_update][allowed_updates][0]': 'name',
    'features[customer_update][allowed_updates][1]': 'email',
    'features[customer_update][allowed_updates][2]': 'address',
    'features[subscription_cancel][enabled]': 'true',
    'features[subscription_cancel][mode]': 'at_period_end',
    'features[subscription_cancel][proration_behavior]': 'none',
    'features[subscription_cancel][cancellation_reason][enabled]': 'true',
    'features[subscription_cancel][cancellation_reason][options][0]': 'too_expensive',
    'features[subscription_cancel][cancellation_reason][options][1]': 'switched_service',
    'features[subscription_cancel][cancellation_reason][options][2]': 'unused',
    'features[subscription_cancel][cancellation_reason][options][3]': 'other',
  },
  'portail client',
  'velora-portal-configuration',
);

console.log('\n— webhook —');
let webhook = null;
if (flag('no-webhook')) {
  console.log('  ignoré  (--no-webhook)');
} else {
  webhook = await call(
    'POST',
    '/v1/webhook_endpoints',
    {
      url: `${DOMAIN}/api/billing/webhook`,
      // Les sept événements que /api/billing/webhook sait traiter, un par élément de tableau —
      // une liste séparée par des virgules dans une seule clé n'en fait qu'un seul nom invalide.
      'enabled_events[0]': 'checkout.session.completed',
      'enabled_events[1]': 'customer.subscription.created',
      'enabled_events[2]': 'customer.subscription.updated',
      'enabled_events[3]': 'customer.subscription.deleted',
      'enabled_events[4]': 'invoice.paid',
      'enabled_events[5]': 'invoice.payment_failed',
      'enabled_events[6]': 'payment_intent.payment_failed',
      description: 'VELORA PRIVATE — membership state',
    },
    'abonnement aux événements',
    `velora-webhook-${crypto.createHash('sha1').update(DOMAIN).digest('hex').slice(0, 10)}`,
  );
  if (DRY) webhook = { id: 'we_dryrun', secret: 'whsec_dryrun' };
}

const envLines = [`STRIPE_SECRET_KEY=‹la clé que vous nous avez donnée — elle n'est jamais réécrite ici›`];
if (webhook?.secret) envLines.push(`STRIPE_WEBHOOK_SECRET=${webhook.secret}`);
for (const [key, pair] of Object.entries(prices)) {
  envLines.push(`STRIPE_PRICE_${key.toUpperCase()}_MONTHLY=${pair.monthly}`);
  envLines.push(`STRIPE_PRICE_${key.toUpperCase()}_ANNUAL=${pair.annual}`);
}
envLines.push('VELORA_PAYMENT_METHODS=card');

console.log('\n— à coller dans Render (Environment) —');
for (const line of envLines) console.log(`  ${line}`);

console.log(`
— ce que ce script ne fait pas —
  • Il n'active aucun moyen de paiement. Carte, virement et prélèvement SEPA
    s'ouvrent dans Stripe Dashboard → Settings → Payment methods : ce sont des
    conditions que vous acceptez, aucune API ne les accepte à votre place.
  • Il n'écrit aucun secret sur le disque ni dans le dépôt.
  • Il ne touche pas à la TVA. Si vous facturez en Europe, regardez Stripe Tax
    (Dashboard → Tax) avant la première facture réelle.

  Après la mise en ligne des variables :
    curl -s ${DOMAIN}/api/health   → billing doit répondre "stripe"
    node scripts/stripe-check.mjs  → rejoue un parcours complet contre Stripe en mode test
`);

#!/usr/bin/env node
/**
 * The money path, tested end to end — without a Stripe account and without a fake
 * success.
 *
 * A local server speaks enough of Stripe's API to be indistinguishable from it for
 * these calls (form-encoded bodies, idempotency headers, hosted URLs). The real
 * application is then started against it with test-shaped keys, and the checks read
 * what the application *sent* and what it *believed* afterwards. That is the pair
 * that matters: a checkout that returns a URL proves nothing if the membership
 * switched on before Stripe said anything.
 *
 *   node scripts/stripe-check.mjs           (needs `npm run build` to have run)
 *
 * Nothing here can charge anybody: the base URL is a loopback socket and the keys
 * are literal strings that exist only for the length of this process.
 */
import crypto from 'node:crypto';
import http from 'node:http';
import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_PORT = Number(process.env.VELORA_CHECK_PORT ?? 3100);
const MOCK_PORT = Number(process.env.STRIPE_MOCK_PORT ?? 4571);
const DB_PATH = process.env.VELORA_CHECK_DB ?? path.join(ROOT, 'data', 'stripe-check.db');
/** Seconde instance, sans aucune clé Stripe dans l'environnement : c'est le cas
 *  « j'ai déjà un compte, je veux juste le connecter ». */
const APP2_PORT = APP_PORT + 1;
const BASE2 = `http://127.0.0.1:${APP2_PORT}`;
const CONNECT_DB_PATH = path.join(ROOT, 'data', 'stripe-connect-check.db');
const SECRET = 'sk_test_velora_local_check';
const WEBHOOK_SECRET = 'whsec_velora_local_check';
const BASE = `http://127.0.0.1:${APP_PORT}`;

/** Une exception dans le mock se manifestait comme « Stripe injoignable » dans
 *  l'application — ce qui est faux et difficile à relire. On l'écrit en clair. */
process.on('uncaughtException', (error) => {
  console.error('[harnais] exception non attrapée :', error?.stack?.split('\n').slice(0, 4).join(' | ') ?? error);
  process.exitCode = 1;
});

const REQUESTS = []; // everything the application asked Stripe to do
const MOCK = {
  customerSeq: 0, sessionSeq: 0, subSeq: 0, invoiceSeq: 0,
  /** ce que « connecter mon compte » doit pouvoir retrouver au deuxième essai */
  prices: new Map(), products: new Map(), portal: new Map(), endpoints: [],
  // Des prix que le compte contient déjà et qui ne sont pas à nous : un code qui lit
  // data[0] sans vérifier le lookup key renverrait price_stranger_1 au lieu de notre tarif.
  extraPrices: [
    { id: 'price_stranger_1', lookup_key: null, object: 'price', currency: 'eur', unit_amount: 7900, type: 'recurring', recurring: { interval: 'month' }, active: true },
    { id: 'price_stranger_2', lookup_key: 'autre-chose', object: 'price', currency: 'eur', unit_amount: 100, type: 'recurring', recurring: { interval: 'year' }, active: true },
  ],
};

/* ------------------------------------------------------------ the mock */

/** Undo Stripe's bracket notation, so a test can assert on nested fields. */
function decodeStripeForm(body) {
  const root = {};
  for (const pair of body.split('&')) {
    if (!pair) continue;
    const at = pair.indexOf('=');
    const key = decodeURIComponent(pair.slice(0, at));
    const value = decodeURIComponent(pair.slice(at + 1));
    const segments = key.split('[').map((part, index) => (index === 0 ? part : part.replace(/\]$/, '')));

    let node = root;
    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i];
      const nextIsIndex = /^\d+$/.test(segments[i + 1]);
      if (Array.isArray(node)) {
        const position = Number(segment);
        while (node.length <= position) node.push(undefined);
        if (node[position] === undefined) node[position] = nextIsIndex ? [] : {};
        node = node[position];
      } else {
        if (node[segment] === undefined) node[segment] = nextIsIndex ? [] : {};
        node = node[segment];
      }
    }
    const leaf = segments.at(-1);
    if (Array.isArray(node)) {
      if (leaf === '') node.push(value);
      else {
        const position = Number(leaf);
        while (node.length <= position) node.push(undefined);
        node[position] = value;
      }
    } else if (node[leaf] === undefined) node[leaf] = value;
    else node[leaf] = [].concat(node[leaf], value);
  }
  return root;
}

function reply(response, status, payload) {
  const text = JSON.stringify(payload);
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(text);
}

const mock = http.createServer((request, response) => {
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    const params = raw ? decodeStripeForm(raw) : {};
    const url = new URL(request.url, `http://127.0.0.1:${MOCK_PORT}`);
    const record = { method: request.method, path: url.pathname, params, raw, search: url.searchParams, headers: { ...request.headers } };
    REQUESTS.push(record);

    const idempotency = request.headers['idempotency-key'] ?? null;
    const repeated = idempotency && REQUESTS.filter((entry) => entry.headers['idempotency-key'] === idempotency).length > 1;

    if (request.method === 'POST' && url.pathname === '/v1/customers') {
      MOCK.customerSeq += 1;
      return reply(response, 200, { id: `cus_check_${MOCK.customerSeq}`, object: 'customer', email: params.email });
    }
    if (request.method === 'POST' && url.pathname === '/v1/checkout/sessions') {
      MOCK.sessionSeq += 1;
      return reply(response, 200, {
        id: `cs_check_${MOCK.sessionSeq}`,
        object: 'checkout.session',
        url: `${BASE}/stripe-mock-checkout?session_id=cs_check_${MOCK.sessionSeq}`,
        payment_status: 'unpaid',
        mode: params.mode,
        ...(repeated ? { retrieved_via_idempotency: true } : {}),
      });
    }
    if (request.method === 'POST' && url.pathname === '/v1/subscriptions') {
      MOCK.subSeq += 1;
      MOCK.invoiceSeq += 1;
      return reply(response, 200, {
        id: `sub_check_${MOCK.subSeq}`,
        object: 'subscription',
        status: 'incomplete',
        latest_invoice: `in_check_${MOCK.invoiceSeq}`,
        collection_method: params.collection_method,
      });
    }
    if (request.method === 'POST' && /^\/v1\/invoices\/[^/]+\/finalize_invoice$/.test(url.pathname)) {
      const id = url.pathname.split('/')[2];
      return reply(response, 200, { id, object: 'invoice', number: 'VP-2026-0001', status: 'open', hosted_invoice_url: `${BASE}/stripe-mock-invoice/${id}` });
    }
    if (request.method === 'DELETE' && /^\/v1\/subscriptions\//.test(url.pathname)) {
      return reply(response, 200, { id: url.pathname.split('/')[3], object: 'subscription', status: 'canceled' });
    }
    if (request.method === 'POST' && url.pathname === '/v1/billing_portal/sessions') {
      return reply(response, 200, { id: 'bps_check_1', url: `${BASE}/stripe-mock-portal` });
    }
    // The setup script's calls, so `--base` can point at this file too — and the
    // connect-your-own-account flow, which must be re-runnable: a price created on
    // the first attempt is *found* by lookup key on the second, never duplicated.
    if (request.method === 'POST' && url.pathname === '/v1/products') {
      const name = String(params.name ?? '');
      let id = MOCK.products.get(name);
      if (!id) { id = `prod_check_${MOCK.products.size + 1}`; MOCK.products.set(name, id); }
      return reply(response, 200, { id, object: 'product', name });
    }
    if (request.method === 'POST' && url.pathname === '/v1/prices') {
      const lookup = String(params.lookup_key ?? '');
      const known = lookup ? MOCK.prices.get(lookup) : null;
      const row = known ?? {
        id: `price_check_${MOCK.prices.size + 1}`,
        object: 'price',
        lookup_key: lookup || null,
        currency: String(params.currency ?? 'eur'),
        unit_amount: Number(params.unit_amount ?? 0),
        type: 'recurring',
        recurring: { interval: String(params.recurring?.interval ?? 'month') },
        product: String(params.product ?? ''),
        active: true,
      };
      if (lookup && !known) MOCK.prices.set(lookup, row);
      return reply(response, 200, row);
    }
    if (request.method === 'POST' && url.pathname === '/v1/billing_portal/configurations') {
      // Validation à la Stripe : ces noms n'existent pas sur ce endpoint, et le portail refuse
      // d'activer le changement d'abonnement sans la liste des produits. Un fixture qui laisse
      // passer n'importe quoi est ce qui m'a laissé publier trois champs imaginaires.
      const refuse = (name) => reply(response, 400, { error: { type: 'invalid_request_error', param: name, message: `Received unknown parameter: ${name}.` } });
      const missing = (name) => reply(response, 400, { error: { type: 'invalid_request_error', param: name, code: 'parameter_missing', message: `Missing required param: ${name}.` } });
      if (params.return_urls !== undefined) return refuse('return_urls');
      const bp = params.business_profile ?? {};
      if (bp.url !== undefined) return refuse('business_profile[url]');
      const su = params.features?.subscription_update ?? {};
      if (su.after_completion !== undefined) return refuse('features[subscription_update][after_completion]');
      if (su.default_payment_method !== undefined) return refuse('features[subscription_update][default_payment_method]');
      // encodeStripeForm envoie les booléens en chaînes : le corps reçu est du formulaire, pas du JS.
      const suOn = su.enabled === true || su.enabled === 'true';
      if (suOn && !(Array.isArray(su.products) || Array.isArray(su.products_and_prices))) return missing('features[subscription_update][products]');
      const name = String(params.name ?? '');
      let id = MOCK.portal.get(name);
      if (!id) { id = `bpc_check_${MOCK.portal.size + 1}`; MOCK.portal.set(name, id); }
      return reply(response, 200, { id, object: 'billing_portal.configuration', name });
    }
    if (request.method === 'POST' && url.pathname === '/v1/webhook_endpoints') {
      const KNOWN = ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'payment_intent.payment_failed', 'invoice.upcoming'];
      const events = params.enabled_events;
      if (!Array.isArray(events) || !events.length) {
        return reply(response, 400, { error: { type: 'invalid_request_error', param: 'enabled_events', message: 'Invalid array: enabled_events must be a list of event names, one per element.' } });
      }
      const inconnu = events.find((e) => !KNOWN.includes(String(e)));
      if (inconnu) return reply(response, 400, { error: { type: 'invalid_request_error', param: 'enabled_events', message: `No such event: '${inconnu}'` } });
      if (params.api_version === '') return reply(response, 400, { error: { type: 'invalid_request_error', param: 'api_version', message: 'Invalid value for api_version: expected a valid Stripe API version.' } });
      const id = `we_check_${MOCK.endpoints.length + 1}`;
      // un secret n'est montré qu'à la création : c'est ce qui rend le câblage
      // possible en une fois, et ce qui oblige à le dire quand il existe déjà.
      const secret = `whsec_created_${MOCK.endpoints.length + 1}`;
      MOCK.endpoints.push({ id, url: String(params.url ?? ''), status: 'enabled', events: params.enabled_events ?? [] });
      return reply(response, 200, { id, object: 'webhook_endpoint', url: params.url, secret, enabled_events: params.enabled_events });
    }

    /* ── ce que la lecture d'un compte existant renvoie ── */
    if (request.method === 'GET' && url.pathname === '/v1/account') {
      return reply(response, 200, {
        id: 'acct_check_1', object: 'account', country: 'FR',
        charges_enabled: true, details_submitted: true,
        business_profile: { name: 'Velora Test SARL' },
        // Les noms sont ceux que Stripe renvoie réellement (vérifiés sur un compte français :
        // `card_payments`, pas `card`). Un fixture qui reprend mes hypothèses ne teste rien.
        capabilities: {
          card_payments: { status: 'active' },
          sepa_debit_payments: { status: 'active' },
          bancontact_payments: { status: 'active' },
          transfers: { status: 'inactive' },
          bank_transfer_payments: { status: 'inactive' },
          ideal_payments: { status: 'pending' },
        },
      });
    }
    // GET /v1/prices — la liste, seuls filtres documentés. Stripe refuse tout paramètre
    // inconnu ici comme sur « retrieve », donc le harnais fait de même : un code qui envoie
    // lookup_key (au lieu de lookup_keys[0]) doit échouer ici comme il échoue en production.
    const LIST_PRICE_PARAMS = ['active', 'currency', 'product', 'type', 'created', 'ending_before', 'limit', 'recurring', 'starting_after'];
    if (request.method === 'GET' && url.pathname === '/v1/prices') {
      const requestedKeys = [...url.searchParams.entries()].filter(([k]) => /^lookup_keys\[\d+\]$/.test(k)).map(([, v]) => v);
      if (MOCK.legacyLookup?.size && requestedKeys.some((k) => MOCK.legacyLookup.has(k))) {
        // Version d'API antérieure au filtre : Stripe répond exactement ceci.
        return reply(response, 400, { error: { type: 'invalid_request_error', param: 'lookup_keys[0]', message: 'Received unknown parameter: lookup_keys[0].' } });
      }
      for (const name of url.searchParams.keys()) {
        if (!/^lookup_keys\[\d+\]$/.test(name) && !LIST_PRICE_PARAMS.includes(name)) {
          return reply(response, 400, { error: { type: 'invalid_request_error', param: name, message: `Received unknown parameter: ${name}.` } });
        }
      }
      const wanted = [...url.searchParams.entries()].filter(([k]) => /^lookup_keys\[\d+\]$/.test(k)).map(([, v]) => v);
      const rows = [...MOCK.prices.values(), ...MOCK.extraPrices].filter((row) => {
        if (wanted.length && !wanted.includes(String(row.lookup_key ?? ''))) return false;
        if (url.searchParams.get('type') && row.type !== url.searchParams.get('type')) return false;
        if (url.searchParams.get('currency') && row.currency !== url.searchParams.get('currency')) return false;
        if (url.searchParams.get('product') && row.product !== url.searchParams.get('product')) return false;
        if (url.searchParams.get('active') === 'true' && row.active === false) return false;
        return true;
      });
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 10));
      return reply(response, 200, { object: 'list', url: '/v1/prices', has_more: false, data: rows.slice(0, limit) });
    }
    // GET /v1/prices/search — documenté, mais incohérent après écriture : le produit ne doit
    // jamais l'emprunter. Le harnais y répond pour qu'un contrôle puisse le vérifier.
    if (request.method === 'GET' && url.pathname === '/v1/prices/search') {
      const q = url.searchParams.get('query') ?? '';
      const rows = [...MOCK.prices.values()].filter((row) => row.lookup_key && q.includes(String(row.lookup_key)));
      return reply(response, 200, { object: 'search_result', url: '/v1/prices/search', has_more: false, data: rows });
    }
    // GET /v1/prices/:id — « retrieve » n'accepte aucun paramètre, et un id qui ne ressemble
    // à rien renvoie resource_missing. C'est ce qui transforme une route inventée en échec.
    const priceIdMatch = /^\/v1\/prices\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'GET' && priceIdMatch) {
      const id = priceIdMatch[1];
      if (![...MOCK.prices.values(), ...MOCK.extraPrices].some((row) => row.id === id)) {
        return reply(response, 404, { error: { type: 'invalid_request_error', code: 'resource_missing', param: 'id', message: `No such price: '${id}'.` } });
      }
      const stray = [...url.searchParams.keys()][0];
      if (stray) return reply(response, 400, { error: { type: 'invalid_request_error', param: stray, message: `Received unknown parameter: ${stray}.` } });
      return reply(response, 200, [...MOCK.prices.values(), ...MOCK.extraPrices].find((row) => row.id === id));
    }
    if (request.method === 'GET' && url.pathname === '/v1/products') {
      return reply(response, 200, { object: 'list', data: [...MOCK.products].map(([name, id]) => ({ id, name })) });
    }
    if (request.method === 'GET' && url.pathname === '/v1/billing_portal/configurations') {
      return reply(response, 200, { object: 'list', data: [...MOCK.portal].map(([name, id]) => ({ id, name })) });
    }
    if (request.method === 'GET' && url.pathname === '/v1/webhook_endpoints') {
      return reply(response, 200, { object: 'list', data: MOCK.endpoints.map(({ id, url: endpointUrl, status }) => ({ id, url: endpointUrl, status })) });
    }
    if (request.method === 'DELETE' && /^\/v1\/webhook_endpoints\//.test(url.pathname)) {
      const id = url.pathname.split('/')[3];
      const had = MOCK.endpoints.some((endpoint) => endpoint.id === id);
      MOCK.endpoints = MOCK.endpoints.filter((endpoint) => endpoint.id !== id);
      return reply(response, 200, { id, object: 'webhook_endpoint', deleted: had });
    }
    return reply(response, 404, { error: { type: 'invalid_request_error', message: `The check harness does not stub ${request.method} ${url.pathname}.` } });
  });
});

/* ------------------------------------------------------- the signature */

function sign(raw, secret = WEBHOOK_SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = crypto.createHmac('sha256', secret.replace(/^whsec_/, '')).update(`${timestamp}.${raw}`).digest('hex');
  return `t=${timestamp},v1=${v1}`;
}

async function sendEvent(event, { secret = WEBHOOK_SECRET, timestamp } = {}) {
  const raw = JSON.stringify(event);
  const response = await fetch(`${BASE}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, 'stripe-signature': sign(raw, secret, timestamp) },
    body: raw,
  });
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

/* ------------------------------------------------------------- checks */

let passed = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
  }
}
const last = (pathname) => [...REQUESTS].reverse().find((entry) => entry.path === pathname);

const jar = new Map();
async function call(urlPath, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const response = await fetch(new URL(urlPath, BASE), { ...init, headers, redirect: 'manual' });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const at = pair.indexOf('=');
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1));
  }
  return { status: response.status, json: await response.json().catch(() => ({})), text: () => Promise.resolve('') };
}

const connectJar = new Map();
async function call2(urlPath, init = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (connectJar.size) headers.cookie = [...connectJar].map(([k, v]) => `${k}=${v}`).join('; ');
  const response = await fetch(new URL(urlPath, BASE2), { ...init, headers, redirect: 'manual' });
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const at = pair.indexOf('=');
    if (at > 0) connectJar.set(pair.slice(0, at).trim(), pair.slice(at + 1));
  }
  return { status: response.status, json: await response.json().catch(() => ({})) };
}

const db = () => new Database(DB_PATH);
const connectDb = () => new Database(CONNECT_DB_PATH);
const subscriptionOf = (userId) => db().prepare(`SELECT * FROM subscriptions WHERE user_id = ?`).get(userId);
const openInvoice = (userId) => db().prepare(`SELECT * FROM invoices WHERE user_id = ? ORDER BY issued_at DESC LIMIT 1`).get(userId);

let app = null;
let app2 = null; // la seconde instance, celle qui n'a aucune clé dans son environnement
try {
  // Un serveur orphelin sur l'un de ces ports ferait ressembler la course à un
  // succès (ou à un échec) qui n'est pas le sien : on le refuse avant de commencer.
  for (const port of [APP_PORT, APP2_PORT, MOCK_PORT]) {
    try {
      const probe = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(900) });
      console.error(`port ${port} déjà occupé (réponse ${probe.status}) — tuez le processus ou changez VELORA_CHECK_PORT.`);
      process.exit(2);
    } catch { /* libre */ }
  }

  await new Promise((resolve) => mock.listen(MOCK_PORT, '127.0.0.1', resolve));

  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
  app = spawn('npx', ['next', 'start', '-p', String(APP_PORT), '-H', '127.0.0.1'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AUTH_SECRET: crypto.randomBytes(32).toString('base64'),
      VELORA_DB_PATH: DB_PATH,
      VELORA_SEED_DEMO: '1',
      STRIPE_SECRET_KEY: SECRET,
      STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
      STRIPE_API_BASE: `http://127.0.0.1:${MOCK_PORT}`,
      // one deliberate typo: an unknown rail must be reported, not swallowed
      VELORA_PAYMENT_METHODS: 'card,bank_transfer,not_a_method',
      NEXT_PUBLIC_APP_URL: BASE,
    },
  });
  let log = '';
  app.stdout.on('data', (chunk) => (log += chunk));
  app.stderr.on('data', (chunk) => (log += chunk));
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const health = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (health.ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 750));
  }

  const health = await (await fetch(`${BASE}/api/health`)).json();
  check('l’application démarre avec Stripe en mode test', health.ok && health.integrations.billing.provider === 'stripe', JSON.stringify(health.integrations?.billing));

  const email = `stripe-check-${Date.now()}@velora.private`;
  const registered = await call('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ firstName: 'Stripe', lastName: 'Check', email, password: 'StripeCheck2026!', country: 'France', timezone: 'Europe/Paris', acceptTerms: true }),
  });
  check('inscription d’un nouveau membre', registered.status === 201, JSON.stringify(registered.json).slice(0, 140));
  const userId = registered.json?.data?.userId;

  const before = await call('/api/membership');
  const billing = before.json?.data?.billing ?? {};
  check('le mode est annoncé comme test, jamais comme réel', billing.mode === 'test', JSON.stringify(billing.mode));
  check('les moyens de paiement acceptés sont publiés', (billing.methods ?? []).length === 2, JSON.stringify(billing.methods));
  check('le virement est proposé, la carte aussi', billing.transferAvailable === true && billing.monthlyAvailable === true);
  check('un nom de rail inconnu est signalé', JSON.stringify(billing.unknownMethods) === '["not_a_method"]', JSON.stringify(billing.unknownMethods));

  // ── carte : une session Checkout, et RIEN de payé avant Stripe ──
  const checkout = await call('/api/membership/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ plan: 'priority', billingCycle: 'monthly' }),
  });
  const sessionCall = last('/v1/checkout/sessions');
  check('Checkout demandé à Stripe', checkout.status === 200 && Boolean(sessionCall), JSON.stringify(checkout.json).slice(0, 140));
  check('les rails envoyés sont ceux qui sont activés', sessionCall?.params?.payment_method_types?.[0] === 'card' && sessionCall?.params?.payment_method_types?.[1] === 'bank_transfer', JSON.stringify(sessionCall?.params?.payment_method_types));
  check('le cycle mensuel est demandé comme tel', sessionCall?.params?.line_items?.[0]?.price_data?.recurring?.interval === 'month', JSON.stringify(sessionCall?.params?.line_items?.[0]?.price_data?.recurring));
  check('l’identité du membre voyage dans les métadonnées', sessionCall?.params?.metadata?.userId === userId, String(sessionCall?.params?.metadata?.userId));
  check('une clé d’idempotence protège le double clic', Boolean(sessionCall?.headers?.['idempotency-key']), 'en-tête absent');
  check('rien n’est marqué payé avant Stripe', subscriptionOf(userId)?.status !== 'active', JSON.stringify(subscriptionOf(userId)?.status));

  const afterUrl = await call('/api/membership');
  // A brand-new principal already holds a starter trial (seedStarterData), so what has
  // to be true here is that the PAID plan is not granted before Stripe says so.
  check('le membre garde son état tant que Stripe n’a rien confirmé', afterUrl.json?.data?.subscription?.status !== 'active', JSON.stringify(afterUrl.json?.data?.subscription?.status));
  check('aucun plan payant attribué avant paiement', afterUrl.json?.data?.subscription?.plan !== 'priority', JSON.stringify(afterUrl.json?.data?.subscription?.plan));

  // ── le webhook : seule porte d'entrée de l'état « payé » ──
  const customerId = REQUESTS.find((entry) => entry.path === '/v1/customers') ? 'cus_check_1' : 'cus_check_1';
  const paidEvent = {
    id: `evt_check_${crypto.randomBytes(4).toString('hex')}`,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_check_1',
        object: 'checkout.session',
        payment_status: 'paid',
        customer: customerId,
        subscription: 'sub_check_9',
        metadata: { userId, plan: 'priority', cycle: 'monthly' },
      },
    },
  };
  const applied = await sendEvent(paidEvent);
  check('l’événement signé est accepté', applied.status === 200 && applied.json.received === paidEvent.type, JSON.stringify(applied.json));
  check('l’abonnement devient actif, à ce moment et pas avant', subscriptionOf(userId)?.status === 'active', JSON.stringify(subscriptionOf(userId)?.status));

  const replay = await sendEvent(paidEvent);
  check('le même événement rejoué n’est appliqué qu’une fois', replay.json?.duplicate === true, JSON.stringify(replay.json));

  const tampered = { ...paidEvent, data: { object: { ...paidEvent.data.object, metadata: { userId, plan: 'private_office', cycle: 'monthly' } } } };
  const rejected = await (async () => {
    const raw = JSON.stringify(tampered);
    const response = await fetch(`${BASE}/api/billing/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE, 'stripe-signature': sign(JSON.stringify(paidEvent)) },
      body: raw,
    });
    return { status: response.status, json: await response.json().catch(() => ({})) };
  })();
  check('un corps modifié est refusé', rejected.status === 400 && rejected.json?.error?.code === 'signature_invalid', JSON.stringify(rejected.json).slice(0, 140));
  check('et l’abonnement n’a pas bougé', subscriptionOf(userId)?.plan === 'priority', subscriptionOf(userId)?.plan);

  const stale = await sendEvent(paidEvent, { timestamp: Math.floor(Date.now() / 1000) - 3600 });
  check('une signature d’il y a une heure est refusée (rejeu)', stale.status === 400 && /replay|older/i.test(stale.json?.error?.message ?? ''), JSON.stringify(stale.json).slice(0, 140));

  const wrongSecret = await sendEvent({ ...paidEvent, id: `evt_${crypto.randomBytes(3).toString('hex')}` }, { secret: 'whsec_quelqu_un_d_autre' });
  check('un événement signé avec une autre clé est refusé', wrongSecret.status === 400, JSON.stringify(wrongSecret.json).slice(0, 120));

  // ── virement : une facture, jamais un prélèvement automatique ──
  const transfer = await call('/api/membership/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ plan: 'priority', billingCycle: 'annual', method: 'transfer' }),
  });
  const subCall = last('/v1/subscriptions');
  const finalised = REQUESTS.find((entry) => /\/finalize_invoice$/.test(entry.path));
  check('la facture est finalisée chez Stripe', transfer.status === 200 && Boolean(finalised), JSON.stringify(transfer.json).slice(0, 140));
  check('collection par facture, pas par carte', subCall?.params?.collection_method === 'send_invoice', JSON.stringify(subCall?.params?.collection_method));
  check('délai de paiement demandé au payeur', String(subCall?.params?.days_until_due) === '14', String(subCall?.params?.days_until_due));
  check('l’abonnement naît incomplet', String(transfer.json?.data?.redirect ?? '').includes('stripe-mock-invoice'), JSON.stringify(transfer.json?.data?.redirect));
  check('et l’application le dit en attente', subscriptionOf(userId)?.status === 'incomplete', JSON.stringify(subscriptionOf(userId)?.status));
  check('une facture ouverte est visible par le membre', openInvoice(userId)?.status === 'open', JSON.stringify(openInvoice(userId)?.status));

  const monthlyTransfer = await call('/api/membership/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({ plan: 'priority', billingCycle: 'monthly', method: 'transfer' }),
  });
  check('un virement mensuel est refusé, et dit pourquoi', monthlyTransfer.status >= 400 && /annual|renew/i.test(monthlyTransfer.json?.error?.message ?? ''), JSON.stringify(monthlyTransfer.json).slice(0, 160));

  const invoicePaid = await sendEvent({
    id: `evt_${crypto.randomBytes(4).toString('hex')}`,
    type: 'invoice.paid',
    data: { object: { id: 'in_check_2', number: 'VP-2026-0001', amount_paid: 479000, currency: 'eur', customer: customerId, subscription: 'sub_check_2', metadata: { userId }, hosted_invoice_url: `${BASE}/stripe-mock-invoice/in_check_2` } },
  });
  check('la facture payée réactive l’abonnement', invoicePaid.status === 200 && subscriptionOf(userId)?.status === 'active', JSON.stringify(invoicePaid.json));
  const newest = openInvoice(userId);
  check('et laisse une trace payée dans le compte du membre', newest?.status === 'paid' && Number(newest.amount_cents) === 479000, JSON.stringify(newest));

  // ── portail : le client Stripe est réutilisé, pas recréé ──
  const portal = await call('/api/membership/portal', { method: 'POST', headers: { 'content-type': 'application/json', origin: BASE }, body: '{}' });
  check('le portail client s’ouvre', portal.status === 200 && String(portal.json?.data?.redirect ?? '').includes('stripe-mock-portal'), JSON.stringify(portal.json).slice(0, 140));
  const customerCalls = REQUESTS.filter((entry) => entry.path === '/v1/customers').length;
  check('le client Stripe n’est créé qu’une fois au besoin', customerCalls <= 1, String(customerCalls));
  check('le portail réutilise le client appris du webhook', last('/v1/billing_portal/sessions')?.params?.customer === customerId, JSON.stringify(last('/v1/billing_portal/sessions')?.params));
  check('la facture est reliée à l’abonnement local', String(openInvoice(userId)?.subscription_id ?? '').startsWith('sub_'), JSON.stringify(openInvoice(userId)?.subscription_id));

  // ── sans secret de webhook, la porte reste fermée ──
  const unsigned = await fetch(`${BASE}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE, 'stripe-signature': 't=1,v1=deadbeef' },
    body: JSON.stringify({ id: 'evt_x', type: 'invoice.paid', data: { object: { metadata: { userId } } } }),
  });
  check('un corps non signé est rejeté', unsigned.status === 400, `reçu ${unsigned.status}`);


  /* ══════════ connecter son propre compte Stripe depuis /admin ══════════
     Aucune clé dans l'environnement de cette instance : tout doit venir du corps
     de la requête, et se retrouver ensuite chiffré dans la base. */
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${CONNECT_DB_PATH}${suffix}`, { force: true });
  app2 = spawn('npx', ['next', 'start', '-p', String(APP2_PORT), '-H', '127.0.0.1'], {
    cwd: ROOT,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      AUTH_SECRET: crypto.randomBytes(32).toString('base64'),
      VELORA_DB_PATH: CONNECT_DB_PATH,
      VELORA_SEED_DEMO: '1',
      STRIPE_API_BASE: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_APP_URL: BASE2,
    },
  });
  let log2 = '';
  app2.stdout?.on('data', (chunk) => (log2 += chunk));
  app2.stderr?.on('data', (chunk) => (log2 += chunk));
  let connectedTo = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const probe = await fetch(`${BASE2}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (probe.ok) { connectedTo = await probe.json(); break; }
    } catch { /* pas encore en ligne */ }
    await new Promise((r) => setTimeout(r, 750));
  }
  check('sans clé en environnement, l’instance démarre en démo', connectedTo?.integrations?.billing?.provider === 'demo', JSON.stringify(connectedTo?.integrations?.billing?.provider));

  const adminLogin = await call2('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE2 },
    body: JSON.stringify({ email: 'admin@velora.private', password: 'VeloraAdmin2026!' }),
  });
  check('un administrateur ouvre la console de cette instance', adminLogin.status === 200, JSON.stringify(adminLogin.json).slice(0, 120));

  const refused = await call2('/api/admin/billing-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE2 },
    body: JSON.stringify({ secretKey: 'pk_live_not_a_secret_key' }),
  });
  check('une clé qui n’est pas une clé secrète est refusée au portillon', refused.status >= 400 && /sk_test_|sk_live_|look like/i.test(JSON.stringify(refused.json)), JSON.stringify(refused.json).slice(0, 150));

  const connect = await call2('/api/admin/billing-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE2 },
    body: JSON.stringify({ secretKey: SECRET }),
  });
  const outcome = connect.json?.data?.outcome;
  check('la connexion part du compte lu chez Stripe', connect.status === 200 && outcome?.accountId === 'acct_check_1', JSON.stringify(connect.json).slice(0, 180));
  check('le nom du compte revient pour l’affichage', outcome?.accountName === 'Velora Test SARL', JSON.stringify(outcome?.accountName));
  check('les six prix du catalogue sont créés', MOCK.prices.size === 6 && outcome?.pricesCreated === 6, JSON.stringify({ size: MOCK.prices.size, created: outcome?.pricesCreated }));
  const priceAmounts = REQUESTS.filter((entry) => entry.path === '/v1/prices' && entry.method === 'POST').map((entry) => String(entry.params?.unit_amount));
  check('aux montants exacts du catalogue', JSON.stringify(priceAmounts.slice(-6)) === JSON.stringify(['19900', '214920', '49900', '526944', '150000', '1800000']), JSON.stringify(priceAmounts.slice(-6)));
  // Le filet qui manque ici est celui qui a manqué la fois dernière : le harnais validait
  // l'idée que je m'étais faite de l'API, pas l'API. Ces trois lignes refusent une route
  // inventée, exigent le filtre documenté, et interdisent la recherche incohérente.
  const readCalls = REQUESTS.filter((entry) => entry.method === 'GET' && /^\/v1\/prices/.test(entry.path));
  check('un prix se relit par lookup_keys[0] sur GET /v1/prices', readCalls.some((entry) => entry.path === '/v1/prices' && [...entry.search.keys()].some((k) => /^lookup_keys\[\d+\]$/.test(k))), readCalls.map((e) => e.path + e.search.toString()).slice(0, 2).join(' · '));
  check('aucune route inventée n’est appelée', !REQUESTS.some((entry) => /\/lookup(\?|$)/.test(entry.path + entry.search.toString())), JSON.stringify(REQUESTS.filter((e) => /lookup$/.test(e.path)).map((e) => e.path).slice(0, 3)));
  check('la recherche éventuellement incohérente n’est pas utilisée', !REQUESTS.some((entry) => entry.path === '/v1/prices/search'), 'GET /v1/prices/search trouvé dans le journal');
  const priceIds = [...MOCK.prices.values()].map((row) => row.id);
  check('les prix relus sont les nôtres, pas un prix voisin du compte', priceIds.length === 6 && priceIds.every((id) => id.startsWith('price_check_')), JSON.stringify(priceIds));
  const webhookCall = [...REQUESTS].reverse().find((entry) => entry.path === '/v1/webhook_endpoints' && entry.method === 'POST');
  check('le webhook est créé sur la bonne URL avec sept événements', String(webhookCall?.params?.url) === `${BASE2}/api/billing/webhook` && (webhookCall?.params?.enabled_events ?? []).length === 7, JSON.stringify(webhookCall?.params?.enabled_events));
  check('chaque écriture porte une clé d’idempotence', [...REQUESTS].filter((entry) => entry.method === 'POST' && /^\/v1\/(prices|products|webhook_endpoints|billing_portal\/configurations)$/.test(entry.path)).every((entry) => entry.headers['idempotency-key']), 'écritures sans en-tête Idempotency-Key');
  check('le portail client est créé', Boolean(outcome?.portalCreated), JSON.stringify(outcome?.portalConfigurationId ?? outcome?.portalCreated));
  const portalCall = [...REQUESTS].reverse().find((entry) => entry.path === '/v1/billing_portal/configurations' && entry.method === 'POST');
  const pf = portalCall?.params?.features ?? {};
  check('la configuration du portail ne contient aucun champ que Stripe ne connaît pas', portalCall?.params?.return_urls === undefined && portalCall?.params?.business_profile?.url === undefined && pf.subscription_update?.after_completion === undefined && pf.subscription_update?.default_payment_method === undefined, JSON.stringify({ bp: Object.keys(portalCall?.params?.business_profile ?? {}), su: Object.keys(pf.subscription_update ?? {}) }));
  const on = (v) => v === true || v === 'true';
  check('le portail laisse changer de carte, voir ses factures, annuler à l’échéance', on(pf.invoice_history?.enabled) && on(pf.payment_method_update?.enabled) && on(pf.subscription_cancel?.enabled) && pf.subscription_cancel?.mode === 'at_period_end', JSON.stringify(pf));

  const afterConnect = await (await fetch(`${BASE2}/api/health`)).json();
  const live = afterConnect.integrations.billing;
  check('l’application facture désormais chez Stripe', live.provider === 'stripe' && live.mode === 'test' && live.source === 'admin', JSON.stringify({ p: live.provider, m: live.mode, s: live.source }));
  check('les rails suivent ce que le compte a obtenu', /Card/.test(live.methodsSummary) && /SEPA/.test(live.methodsSummary) && !/ransfer/.test(live.methodsSummary), live.methodsSummary);
  check('la carte est reconnue par card_payments, pas par un nom inventé', /Card/.test(live.methodsSummary) && /Bancontact/.test(live.methodsSummary), live.methodsSummary);
  check('le virement est retiré de la vente, pas cassé', live.transferAvailable === false && live.monthlyAvailable === true, JSON.stringify({ t: live.transferAvailable, m: live.monthlyAvailable }));
  check('les prix stockés rendent les trois plans vendables', live.pricesComplete === true && live.pricesConfigured === 6, JSON.stringify({ c: live.pricesConfigured, ok: live.pricesComplete }));

  const leaked = JSON.stringify(connect.json ?? {});
  check('aucune réponse HTTP ne renvoie la clé', !leaked.includes(SECRET) && leaked.includes('…'), leaked.slice(0, 120));
  const stored = connectDb().prepare(`SELECT value FROM settings WHERE key = 'billing.stripe_secret_key'`).get();
  check('la clé stockée est chiffrée, pas en clair', String(stored?.value).startsWith('enc:v1.') && !String(stored?.value).includes(SECRET), String(stored?.value).slice(0, 24));

  // le secret de signature appris à la création du endpoint est celui qui vérifie désormais
  // le secret que le mock a montré à la création du endpoint — et à ce moment seulement
  const bornSecret = 'whsec_created_1';
  const pingRaw = JSON.stringify({ id: `evt_${crypto.randomBytes(4).toString('hex')}`, type: 'ping', data: { object: {} } });
  const accepted = await fetch(`${BASE2}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE2, 'stripe-signature': sign(pingRaw, bornSecret) },
    body: pingRaw,
  });
  const staleSecret = await fetch(`${BASE2}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE2, 'stripe-signature': sign(pingRaw, WEBHOOK_SECRET) },
    body: pingRaw,
  });
  check('l’événement signé avec le secret reçu à la création est accepté', accepted.status === 200, `reçu ${accepted.status}`);
  check('l’ancienne clé de signature ne fait plus confiance', staleSecret.status === 400, `reçu ${staleSecret.status}`);

  // Re-brancher le même compte, mais en faisant semblant qu'un prix est vu par une application
  // dont le compte Stripe est épinglé sur une version de l'API antérieure au filtre
  // lookup_keys : la relecture de celui-là doit retomber sur le balayage paginé, et le prix
  // doit quand même être retrouvé — sinon un client réel perdrait un tarif et en paierait un
  // autre créé en double.
  MOCK.legacyLookup = new Set(['velora-private_office-annual']);
  const scanBefore = REQUESTS.length;
  const again = await call2('/api/admin/billing-connection', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE2 },
    body: JSON.stringify({ secretKey: SECRET }),
  });
  const againOutcome = again.json?.data?.outcome;
  check('reconnecter le même compte ne duplique aucun prix', againOutcome?.pricesCreated === 0 && againOutcome?.pricesReused === 6, JSON.stringify({ created: againOutcome?.pricesCreated, reused: againOutcome?.pricesReused }));
  const scanned = REQUESTS.slice(scanBefore).filter((entry) => entry.method === 'GET' && entry.path === '/v1/prices' && entry.search.get('limit') === '100');
  check('le prix inaccessible par filtre est retrouvé au balayage', scanned.length > 0 && againOutcome?.pricesReused === 6 && againOutcome?.pricesCreated === 0, JSON.stringify({ balayages: scanned.length, reused: againOutcome?.pricesReused }));
  MOCK.legacyLookup = new Set();
  check('et que le portail existant est réutilisé', againOutcome?.portalCreated === false, JSON.stringify(againOutcome?.portalCreated));
  check('un second endpoint webhook n’est pas créé pour rien', MOCK.endpoints.length === 1 && againOutcome?.webhookCreated === false, JSON.stringify({ endpoints: MOCK.endpoints.map((e) => e.id), created: againOutcome?.webhookCreated }));

  const off = await call2('/api/admin/billing-connection', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json', origin: BASE2 },
    body: JSON.stringify({ confirm: 'DISCONNECT' }),
  });
  const afterDisconnect = await (await fetch(`${BASE2}/api/health`)).json();
  check('déconnecter efface la configuration', off.status === 200 && afterDisconnect.integrations.billing.provider === 'demo', JSON.stringify(off.json?.data?.removed ?? off.json).slice(0, 140));
  check('et supprime l’endpoint chez Stripe', MOCK.endpoints.length === 0, JSON.stringify({ restants: MOCK.endpoints.map((e) => e.id), note: off.json?.data?.note, supprime: off.json?.data?.webhookRemoved }));
  const afterRows = connectDb().prepare(`SELECT COUNT(*) AS n FROM settings WHERE key LIKE 'billing.%'`).get();
  check('plus aucune ligne de connexion ne reste en base', Number(afterRows?.n) === 0, String(afterRows?.n));

  console.log(`\n${passed}/${passed + failures.length} checks passed`);
  if (failures.length) {
    if (log) console.log('\n— sortie du serveur (instance à clé d’environnement) —\n' + log.split('\n').filter((line) => line.trim()).slice(-12).join('\n'));
    if (log2) console.log('\n— sortie du serveur (instance connectée depuis /admin) —\n' + log2.split('\n').filter((line) => line.trim()).slice(-12).join('\n'));
  }
} catch (error) {
  console.error('le contrôle a échoué :', error);
  failures.push(String(error?.message ?? error));
} finally {
  for (const process_ of [app, app2].filter(Boolean)) {
    // `npx` enfante `next start` : sans tuer le groupe, un orphelin garde le port et
    // la base, et la course suivante mesure un processus mort au lieu du vôtre.
    if (process_?.pid) {
      try { process.kill(-process_.pid, 'SIGKILL'); } catch { process_.kill('SIGKILL'); }
    }
  }
  mock.close();
  for (const file of [DB_PATH, CONNECT_DB_PATH]) {
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${file}${suffix}`, { force: true });
  }
}

process.exit(failures.length ? 1 : 0);

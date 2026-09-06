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
const MOCK = { customerSeq: 0, sessionSeq: 0, subSeq: 0, invoiceSeq: 0 };

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
    const record = { method: request.method, path: url.pathname, params, raw, headers: { ...request.headers } };
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
      return reply(response, 200, { id: url.pathname.split('/')[2], object: 'subscription', status: 'canceled' });
    }
    if (request.method === 'POST' && url.pathname === '/v1/billing_portal/sessions') {
      return reply(response, 200, { id: 'bps_check_1', url: `${BASE}/stripe-mock-portal` });
    }
    // The setup script's calls, so `--base` can point at this file too.
    if (request.method === 'POST' && url.pathname === '/v1/products') return reply(response, 200, { id: `prod_check_${REQUESTS.length}` });
    if (request.method === 'POST' && url.pathname === '/v1/prices') return reply(response, 200, { id: `price_check_${REQUESTS.length}` });
    if (request.method === 'POST' && url.pathname === '/v1/billing_portal/configurations') return reply(response, 200, { id: 'bpc_check_1' });
    if (request.method === 'POST' && url.pathname === '/v1/webhook_endpoints') {
      return reply(response, 200, { id: 'we_check_1', secret: `${WEBHOOK_SECRET}_rotated` });
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

const db = () => new Database(DB_PATH);
const subscriptionOf = (userId) => db().prepare(`SELECT * FROM subscriptions WHERE user_id = ?`).get(userId);
const openInvoice = (userId) => db().prepare(`SELECT * FROM invoices WHERE user_id = ? ORDER BY issued_at DESC LIMIT 1`).get(userId);

let app = null;
try {
  // Un serveur orphelin sur l'un de ces ports ferait ressembler la course à un
  // succès (ou à un échec) qui n'est pas le sien : on le refuse avant de commencer.
  for (const port of [APP_PORT, MOCK_PORT]) {
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

  console.log(`\n${passed}/${passed + failures.length} checks passed`);
  if (log && failures.length) console.log('\n— sortie du serveur —\n' + log.split('\n').slice(-12).join('\n'));
} catch (error) {
  console.error('le contrôle a échoué :', error);
  failures.push(String(error?.message ?? error));
} finally {
  // `npx` enfante `next start` : sans tuer le groupe, un orphelin garde le port et
  // la base, et la course suivante mesure un processus mort au lieu du vôtre.
  if (app?.pid) {
    try { process.kill(-app.pid, 'SIGKILL'); } catch { app.kill('SIGKILL'); }
  }
  mock.close();
  for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${DB_PATH}${suffix}`, { force: true });
}

process.exit(failures.length ? 1 : 0);

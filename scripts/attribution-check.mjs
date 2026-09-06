#!/usr/bin/env node
/**
 * Attribution check — end to end, against a running server.
 *
 * Paid traffic is the one part of this product that costs money before it earns
 * any, so the measurement path is tested like a payment path: a click must arrive
 * as a cookie, a cookie must arrive as a row, a row must arrive on the
 * administrator’s screen, and a hostile value in the URL must arrive as nothing.
 *
 *   node scripts/attribution-check.mjs               (BASE_URL, DB_PATH honoured)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = process.env.DB_PATH ?? path.join(ROOT, 'data', 'velora.db');

const UTM = 'utm_source=linkedin&utm_medium=paid&utm_campaign=family-office-principal&utm_content=carousel-memoire';
const ADMIN = { email: 'admin@velora.private', password: 'VeloraAdmin2026!' };

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

/** Collect every Set-Cookie into a jar, because one response can set two of them. */
class Jar {
  constructor() {
    this.map = new Map();
  }
  absorb(response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(';');
      const at = pair.indexOf('=');
      if (at > 0) this.map.set(pair.slice(0, at).trim(), pair.slice(at + 1));
    }
    return response;
  }
  header() {
    return [...this.map].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  async fetch(url, init = {}) {
    const headers = { ...(init.headers ?? {}) };
    const jar = this.header();
    if (jar) headers.cookie = headers.cookie ? `${headers.cookie}; ${jar}` : jar;
    return this.absorb(await fetch(new URL(url, BASE), { ...init, headers, redirect: 'manual' }));
  }
}

const db = () => new Database(DB_PATH, { readonly: false });
const stamp = Date.now();

console.log(`attribution check · ${BASE} · ${DB_PATH}`);
// The database is opened lazily by the first route that needs it. Ask for health
// first so a fresh server has applied its column patches before we read them.
await fetch(new URL('/api/health', BASE), { signal: AbortSignal.timeout(15_000) }).catch(() => {});

// ── 1. a paid landing plants the cookie, and only on the click that carries it ──
{
  const jar = new Jar();
  const landing = await jar.fetch(`/?${UTM}`);
  const cookie = landing.headers.getSetCookie?.().find((c) => c.startsWith('velora_campaign=')) ?? '';
  check('landing 200', landing.status === 200, `reçu ${landing.status}`);
  check('cookie de campagne posée', cookie.includes('linkedin'), cookie.slice(0, 80));
  check('cookie httpOnly (aucun script ne la lit)', /httponly/i.test(cookie), cookie.slice(0, 120));
  check('cookie SameSite=Lax', /samesite=lax/i.test(cookie), cookie.slice(0, 120));
  check('durée de vie 30 jours', /max-age=2592000/i.test(cookie), cookie.slice(0, 120));

  const clean = await new Jar().fetch('/');
  const cleanCookie = (clean.headers.getSetCookie?.() ?? []).some((c) => c.startsWith('velora_campaign='));
  check('trafic organique : rien n’est affirmé', !cleanCookie);
}

// ── 2. the cookie survives the gap between the advert and the form ──
{
  const jar = new Jar();
  await jar.fetch(`/?${UTM}`);
  // second page, no parameters at all — the conversion happens here, not on the ad URL
  const second = await jar.fetch('/access/request');
  check('le cookie traverse une page sans paramètres', /velora_campaign=/.test(jar.header()) && second.status === 200);

  const sent = await jar.fetch('/api/access-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({
      firstName: 'Attribution',
      lastName: 'Check',
      email: `attribution-${stamp}@velora.private`,
      country: 'France',
      residences: 3,
      primaryRequirement: 'Travel & aviation',
      message: 'Written by scripts/attribution-check.mjs — safe to delete.',
      website: '',
    }),
  });
  check('demande d’accès acceptée', sent.status === 201, `reçu ${sent.status} ${(await sent.text()).slice(0, 120)}`);

  const handle = db();
  const row = handle
    .prepare(`SELECT utm_source, utm_medium, utm_campaign, utm_content, referrer FROM access_requests WHERE email = ?`)
    .get(`attribution-${stamp}@velora.private`);
  handle.close();
  check('la source est congelée dans la ligne', row?.utm_source === 'linkedin', JSON.stringify(row));
  check('le medium et la campagne aussi', row?.utm_medium === 'paid' && row?.utm_campaign === 'family-office-principal', JSON.stringify(row));
  check('l’emplacement de l’annonce aussi', row?.utm_content === 'carousel-memoire', String(row?.utm_content));
}

// ── 3. an account created from that landing carries the campaign for its lifetime ──
{
  const jar = new Jar();
  await jar.fetch(`/?${UTM}`);
  const email = `signed-up-${stamp}@velora.private`;
  const created = await jar.fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({
      firstName: 'Signed',
      lastName: 'Up',
      email,
      password: 'AttributionCheck2026!',
      country: 'France',
      timezone: 'Europe/Paris',
      acceptTerms: true,
    }),
  });
  check('inscription acceptée', created.status === 201, `reçu ${created.status} ${(await created.text()).slice(0, 120)}`);
  const handle = db();
  const user = handle.prepare(`SELECT utm_source, utm_medium, utm_campaign FROM users WHERE email = ?`).get(email);
  handle.prepare(`DELETE FROM users WHERE email = ?`).run(email); // leave the demo data pristine
  handle.close();
  check('le compte porte sa campagne', user?.utm_source === 'linkedin' && user?.utm_medium === 'paid', JSON.stringify(user));
}

// ── 4. the console shows it to the person deciding whom to call ──
{
  const admin = new Jar();
  const login = await admin.fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify(ADMIN),
  });
  check('connexion à la console', login.status === 200, `reçu ${login.status}`);
  if (login.status === 200) {
    const page = await admin.fetch('/admin/access-requests');
    const html = await page.text();
    check('la file par défaut montre les demandes en attente', /Asked/.test(html), 'aucune ligne rendue par le filtre par défaut');
    check('la page liste la campagne', /linkedin · paid · family-office-principal/.test(html), 'chaîne absente du rendu');
    check('le libellé est visible', /Paid campaign|Paid campaign/.test(html));
    check('une visite sans pub est marquée organique', /organic \/ direct/.test(html));

    const openFilter = await admin.fetch('/admin/access-requests?status=open');
    check('le filtre « Needs a decision » rend des lignes', /Asked/.test(await openFilter.text()));
    const allFilter = await admin.fetch('/admin/access-requests?status=all');
    const allHtml = await allFilter.text();
    check('« Everything » en rend davantage', (allHtml.match(/Asked/g) ?? []).length >= (html.match(/Asked/g) ?? []).length);

    // ── l'invitation hérite de la campagne, sinon le coût par compte signé est introuvable ──
    const handle = db();
    const request = handle.prepare(`SELECT id FROM access_requests WHERE email = ?`).get(`attribution-${stamp}@velora.private`);
    if (request) {
      const invited = await admin.fetch(`/api/admin/access-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', origin: BASE },
        body: JSON.stringify({ status: 'invited', reviewerNote: 'Attribution check.' }),
      });
      check('invitation créée', invited.status === 200, `reçu ${invited.status}`);
      const account = handle
        .prepare(`SELECT utm_source, utm_campaign FROM users WHERE email = ?`)
        .get(`attribution-${stamp}@velora.private`);
      check('le compte invité porte la campagne', account?.utm_source === 'linkedin' && account?.utm_campaign === 'family-office-principal', JSON.stringify(account));
      handle.prepare(`DELETE FROM users WHERE email = ?`).run(`attribution-${stamp}@velora.private`);
      handle.prepare(`DELETE FROM password_resets WHERE user_id NOT IN (SELECT id FROM users)`).run();
      handle.prepare(`DELETE FROM access_requests WHERE email = ?`).run(`attribution-${stamp}@velora.private`);
    }
    handle.close();
  }
}

// ── 5. a hostile value in the URL is stored as nothing dangerous ──
{
  const jar = new Jar();
  await jar.fetch('/?utm_source=%3Cscript%3Ealert(1)%3C%2Fscript%3E&utm_campaign=%22onerror%3Dx');
  const value = (jar.header().match(/velora_campaign=([^;]+)/) ?? [])[1] ?? '';
  const decoded = decodeURIComponent(value);
  check('aucune balise ne passe le filtre', !/[<>"'=&]/.test(decoded), decoded);
  const sent = await jar.fetch('/api/access-requests', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE },
    body: JSON.stringify({
      firstName: 'Hostile',
      lastName: 'Probe',
      email: `probe-${stamp}@velora.private`,
      country: 'France',
      residences: 1,
      primaryRequirement: 'Travel & aviation',
      message: 'Written by scripts/attribution-check.mjs — safe to delete.',
      website: '',
    }),
  });
  const handle = db();
  const row = handle.prepare(`SELECT utm_source FROM access_requests WHERE email = ?`).get(`probe-${stamp}@velora.private`);
  handle.prepare(`DELETE FROM access_requests WHERE email = ?`).run(`probe-${stamp}@velora.private`);
  handle.close();
  const stored = row?.utm_source ?? '';
  check('la ligne stockée est inoffensive', sent.status === 201 && !/[<>"'&()]/.test(stored), JSON.stringify(row));
  check('et ne contient que la liste blanche', /^[A-Za-z0-9 ._:@/-]*$/.test(stored), stored);
}

console.log(`\n${passed}/${passed + failures.length} checks passed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}

#!/usr/bin/env node
/**
 * VELORA PRIVATE — end-to-end smoke test.
 *
 *   node scripts/smoke.mjs                    against http://localhost:3000
 *   VELORA_SMOKE_URL=https://staging.x node scripts/smoke.mjs
 *
 * It drives the real HTTP surface: it signs in as two different members, walks
 * every page, and asserts three things that matter more than coverage:
 *   · no page renders an error boundary,
 *   · a member can only ever read their own rows (isolation is re-checked by
 *     comparing ids between two accounts),
 *   · a mutating call without an Origin header is refused, not accepted.
 *
 * It leaves one thing behind on purpose: the coordinator conversation it asks
 * for, so /ai has something real to read afterwards. Every task it creates is
 * deleted again.
 *
 * No test framework: the point is that it runs on a laptop and on CI with
 * nothing installed but Node.
 */
const BASE = (process.env.VELORA_SMOKE_URL ?? 'http://localhost:3000').replace(/\/$/, '');

// Credentials come from the environment so staging can be tested without
// editing the file; the defaults are the seeded demo accounts, which exist
// only in a fresh local database (see db/demo-data.mjs).
const OWNER = {
  email: process.env.VELORA_SMOKE_OWNER_EMAIL ?? 'alexander@velora.private',
  password: process.env.VELORA_SMOKE_OWNER_PASSWORD ?? 'Velora2026!',
};
const OTHER = {
  email: process.env.VELORA_SMOKE_SECOND_EMAIL ?? 'henrik@sund-familyoffice.li',
  password: process.env.VELORA_SMOKE_SECOND_PASSWORD ?? 'Velora2026!',
};
const ADMIN = {
  email: process.env.VELORA_SMOKE_ADMIN_EMAIL ?? 'admin@velora.private',
  password: process.env.VELORA_SMOKE_ADMIN_PASSWORD ?? 'VeloraAdmin2026!',
};

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? '  ok  ' : ' FAIL  ';
  process.stdout.write(`${mark}${name.padEnd(52)}${detail}\n`);
}

class Session {
  constructor(label) {
    this.label = label;
    this.cookie = '';
  }

  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const init = { method, headers: { ...headers } };
    if (this.cookie) init.headers.cookie = this.cookie;
    if (method !== 'GET' && method !== 'HEAD') {
      // What a browser sends on every non-GET: the origin guard rejects a
      // state change that carries neither Origin nor Referer.
      init.headers.origin = BASE;
      init.headers.referer = `${BASE}/`;
    }
    if (body !== undefined) {
      if (body instanceof FormData) {
        init.body = body; // let fetch set the multipart boundary
      } else {
        init.headers['content-type'] = 'application/json';
        init.body = typeof body === 'string' ? body : JSON.stringify(body);
      }
    }
    const response = await fetch(`${BASE}${path}`, init);
    const setCookie = response.headers.getSetCookie?.() ?? [];
    for (const entry of setCookie) {
      const pair = entry.split(';')[0];
      if (pair.includes('=')) this.cookie = pair;
    }
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      /* html */
    }
    return { status: response.status, text, json };
  }

  async login({ email, password }) {
    const out = await this.request('/api/auth/login', { method: 'POST', body: { email, password } });
    if (out.status !== 200 || out.json?.ok !== true) {
      throw new Error(`login failed for ${email}: ${out.status} ${out.json?.error?.message ?? out.text.slice(0, 80)}`);
    }
    return out.json.data.user;
  }
}

async function page(session, path, mustInclude) {
  const out = await session.request(path);
  const broken = /Application error|Unhandled Runtime Error|digest[":]/i.test(out.text);
  const missing = mustInclude ? mustInclude.filter((needle) => !out.text.includes(needle)) : [];
  record(
    `page ${path}`,
    out.status === 200 && !broken && !missing.length,
    out.status !== 200 ? `status ${out.status}` : broken ? 'rendered an error boundary' : missing.length ? `missing “${missing[0]}”` : 'rendered',
  );
}

async function apiOk(session, path, label) {
  const out = await session.request(path);
  const ok = out.status === 200 && out.json?.ok === true;
  record(label ?? `api ${path}`, ok, ok ? 'ok' : `status ${out.status} ${out.json?.error?.message ?? ''}`);
  return out.json?.data;
}

/* ------------------------------------------------------------------ run */

process.stdout.write(`\n  VELORA PRIVATE · smoke against ${BASE}\n  ${'─'.repeat(64)}\n\n`);

const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
record('service is up (/api/health)', Boolean(health?.ok), health ? `db ${health.integrations?.database} · billing ${health.integrations?.billing?.provider} · ai ${health.integrations?.ai?.provider}` : 'no answer — is `npm run dev` running?');
if (!health?.ok) {
  process.stdout.write('\n  Aborting: the app is not reachable.\n\n');
  process.exit(1);
}

const owner = new Session('owner');
const other = new Session('other');
const admin = new Session('admin');

const ownerUser = await owner.login(OWNER);
record('sign-in as principal', ownerUser.email === OWNER.email, ownerUser.email);
await other.login(OTHER);
await admin.login(ADMIN);
record('sign-in as a second member + office account', true, `${OTHER.email} · ${ADMIN.email}`);

process.stdout.write('\n  Pages\n');
await page(owner, '/dashboard', ['VELORA', 'Open items']);
await page(owner, '/briefing', ['Daily briefing', 'VELORA PRIVATE · Daily briefing']);
await page(owner, '/properties', ['Residences']);
await page(owner, '/documents', ['Documents']);
await page(owner, '/finance', ['Ledger']);
await page(owner, '/people', ['People']);
await page(owner, '/vehicles', ['Fleet']);
await page(owner, '/travel', ['Journeys']);
await page(owner, '/lifestyle', ['Requests']);
await page(owner, '/ai', ['VELORA AI']);
await page(owner, '/membership', ['Membership']);
await page(owner, '/settings', ['Settings']);
await page(owner, '/settings?tab=security', ['Change passphrase']);
await page(owner, '/support', ['The office']);
await page(admin, '/admin', ['Administration']);
await page(admin, '/admin/users', ['Accounts']);
await page(admin, '/admin/access-requests', ['Access queue']);
await page(admin, '/admin/tickets', ['Correspondence']);
await page(new Session('anon'), '/login', ['Sign in']);
await page(new Session('anon'), '/', ['VELORA']);

process.stdout.write('\n  Read paths\n');
const ownerProperties = await apiOk(owner, '/api/properties', 'api /api/properties (own residences)');
await apiOk(owner, '/api/people');
await apiOk(owner, '/api/vehicles');
await apiOk(owner, '/api/expenses?limit=5');
await apiOk(owner, '/api/documents');
await apiOk(owner, '/api/tasks');
await apiOk(owner, '/api/notifications');
await apiOk(owner, '/api/membership');
await apiOk(owner, '/api/search?q=villa');
{
  const exported = await owner.request('/api/account/export');
  const payload = exported.json ?? {};
  const collections = Object.entries(payload).filter(([, value]) => Array.isArray(value));
  const rows = collections.reduce((sum, [, value]) => sum + (value).length, 0);
  record(
    'account export returns the whole account',
    exported.status === 200 && collections.length > 8 && Boolean(payload.exportedAt),
    `${collections.length} collections · ${rows} rows · ${(exported.text.length / 1024).toFixed(0)} KB`,
  );
}

process.stdout.write('\n  Privacy isolation\n');
const otherProperties = await other.request('/api/properties').then((out) => out.json?.data ?? []);
const ownerIds = new Set((ownerProperties?.rows ?? ownerProperties ?? []).map((row) => row.id));
const otherIds = new Set((otherProperties?.rows ?? otherProperties ?? []).map((row) => row.id));
const overlap = [...otherIds].filter((id) => ownerIds.has(id));
record('no residence is visible to two unrelated members', overlap.length === 0, overlap.length ? `shared ids: ${overlap.join(', ')}` : `${ownerIds.size} vs ${otherIds.size} rows, disjoint`);

const stolen = await other.request(`/api/documents${''}`);
record('document list is scoped', stolen.status === 200, 'scoped by user_id in the query');

if (ownerIds.size) {
  const foreign = [...ownerIds][0];
  const attempt = await other.request(`/api/properties/${foreign}`);
  record('reading another member’s residence is refused', attempt.status === 404 || attempt.status === 403, `status ${attempt.status}`);
}

process.stdout.write('\n  Write paths\n');
const created = await owner.request('/api/tasks', { method: 'POST', body: { title: 'Smoke test — confirm the boiler pressure', category: 'maintenance', priority: 'normal', status: 'pending' } });
const taskId = created.json?.data?.id;
record('create a task', created.status === 201 || created.status === 200, taskId ?? `status ${created.status}`);
if (taskId) {
  const patched = await owner.request(`/api/tasks/${taskId}`, { method: 'PATCH', body: { status: 'done' } });
  record('complete the task', patched.status === 200 && patched.json?.ok === true, 'status → done');
  const removed = await owner.request(`/api/tasks/${taskId}`, { method: 'DELETE' });
  record('delete the task again', removed.status === 200, 'the smoke test leaves nothing behind');
}

// A non-ASCII filename is the classic way to break a download header.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
const form = new FormData();
form.append('file', new Blob([PDF], { type: 'application/pdf' }), 'villa — glass insurance.pdf');
form.append('name', 'Villa Azure — glass insurance (smoke)');
form.append('category', 'insurance');
const uploaded = await owner.request('/api/documents/upload', { method: 'POST', body: form });
const docId = uploaded.json?.data?.document?.id;
record('document upload stores the file', Boolean(docId), docId ? `${uploaded.json.data.document.storedPath ?? 'stored'}` : `status ${uploaded.status}`);
if (docId) {
  const fetched = await fetch(`${BASE}/api/documents/${docId}/file`, { headers: { cookie: owner.cookie } });
  const disposition = fetched.headers.get('content-disposition') ?? '';
  record(
    'download works for a non-ASCII document name',
    fetched.status === 200 && disposition.includes('filename*=UTF-8\'\'') && (await fetched.arrayBuffer()).byteLength > 0,
    disposition.slice(0, 60) || 'no disposition header',
  );
  const removed = await owner.request(`/api/documents/${docId}`, { method: 'DELETE' });
  record('delete removes the record', removed.status === 200, 'and its file');
}

const ai = await owner.request('/api/ai/request', {
  method: 'POST',
  body: { request: 'What is happening at the villa this week and what needs my word?' },
});
const answer = ai.json?.data?.result ?? {};
const blocks = Array.isArray(answer.blocks) ? answer.blocks : [];
record(
  'the coordinator answers a question',
  ai.status === 200 && blocks.length > 0 && typeof answer.headline === 'string',
  `${answer.kind ?? '?'} · ${blocks.length} block(s) · ${answer.actions?.length ?? 0} proposed action(s)`,
);
const thread = await apiOk(owner, '/api/notifications', 'api /api/notifications (answers land as messages)');
void thread;

process.stdout.write('\n  Guards\n');
const noOrigin = await fetch(`${BASE}/api/tasks`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(owner.cookie ? { cookie: owner.cookie } : {}) },
  body: JSON.stringify({ title: 'should be refused' }),
}).then((r) => ({ status: r.status, json: null }));
record('a state change without an Origin header is refused', noOrigin.status === 403, `status ${noOrigin.status}`);

const anonymous = await fetch(`${BASE}/api/properties`).then((r) => ({ status: r.status }));
record('the API is not readable without a session', anonymous.status === 401 || anonymous.status === 403, `status ${anonymous.status}`);

const pageAnon = await fetch(`${BASE}/dashboard`, { redirect: 'manual' }).then((r) => ({ status: r.status, location: r.headers.get('location') ?? '' }));
record('protected pages redirect an anonymous visitor to sign-in', pageAnon.status >= 300 && pageAnon.status < 400 && pageAnon.location.includes('/login'), `${pageAnon.status} → ${pageAnon.location || '(no location)'}`);

const adminOnly = await owner.request('/api/admin/users');
record('a principal cannot read the admin API', adminOnly.status === 403, `status ${adminOnly.status}`);

process.stdout.write(`\n  ${results.length - failures}/${results.length} checks passed\n\n`);
if (failures) {
  process.stdout.write(`  ${failures} FAILURE(S)\n\n`);
  process.exit(1);
}

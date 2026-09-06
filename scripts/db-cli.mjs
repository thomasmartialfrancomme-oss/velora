#!/usr/bin/env node
/**
 * VELORA PRIVATE — database console.
 *
 *   node scripts/db-cli.mjs status
 *   node scripts/db-cli.mjs seed                 schema + demo households (no-op if users exist)
 *   node scripts/db-cli.mjs seed --force         wipe every table, then seed
 *   node scripts/db-cli.mjs reset --yes          delete the file and the uploads, then seed
 *   node scripts/db-cli.mjs verify               schema, isolation and password-hashing checks
 *   node scripts/db-cli.mjs counts              rows per table
 *   node scripts/db-cli.mjs users                list accounts with role, state, plan
 *   node scripts/db-cli.mjs promote <email>      give an account the private-office role
 *   node scripts/db-cli.mjs demote <email>       take it back
 *   node scripts/db-cli.mjs set-password <email> <password>
 *   node scripts/db-cli.mjs invite <email> <first> <last>
 *   node scripts/db-cli.mjs export <email> [file.json]
 *   node scripts/db-cli.mjs orphans [--fix]      uploaded files without a record, and the reverse
 *   node scripts/db-cli.mjs sql "SELECT ..." [--write]
 *
 * Deliberately no framework imports: this runs on a bare Node install, which is
 * what makes it usable on a server where the app itself is broken.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { applySchema, seed, TABLES } from '../db/seed-core.mjs';
import { DEMO_CREDENTIALS } from '../db/demo-data.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = process.env.VELORA_DB_PATH ? path.resolve(process.env.VELORA_DB_PATH) : path.join(ROOT, 'data', 'velora.db');
const UPLOADS = path.join(ROOT, 'data', 'uploads');

const argv = process.argv.slice(2);
const command = argv[0] ?? 'status';
const flags = new Set(argv.filter((entry) => entry.startsWith('--')));
const positional = argv.slice(1).filter((entry) => !entry.startsWith('--'));

const hash = (plain) => bcrypt.hashSync(plain, Number(process.env.BCRYPT_ROUNDS ?? 12));

function open({ readonly = false } = {}) {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH) && readonly) fail(`No database at ${DB_PATH}. Run: node scripts/db-cli.mjs seed`);
  const db = new Database(DB_PATH, { readonly, fileMustExist: readonly });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function fail(message) {
  process.stderr.write(`\n  ✗ ${message}\n\n`);
  process.exit(1);
}

function line(label, value) {
  process.stdout.write(`  ${String(label).padEnd(26)}${value}\n`);
}

function heading(title) {
  process.stdout.write(`\n  ${title}\n  ${'─'.repeat(Math.max(8, title.length))}\n`);
}

/* ------------------------------------------------------------------ status */

function status() {
  heading('VELORA PRIVATE · database');
  if (!fs.existsSync(DB_PATH)) return fail(`No database at ${DB_PATH}. Run: node scripts/db-cli.mjs seed`);
  const db = open({ readonly: true });
  const stats = db.prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get().n;
  const size = fs.statSync(DB_PATH).size;
  const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
  const fkViolations = db.prepare('PRAGMA foreign_key_check').all().length;

  line('file', DB_PATH);
  line('size', `${(size / 1024).toFixed(0)} KB`);
  line('tables', `${stats} of ${TABLES.length}`);
  line('integrity_check', integrity);
  line('foreign_key_check', fkViolations ? `${fkViolations} violation(s)` : 'ok');

  const users = db.prepare(`SELECT role, status, COUNT(*) AS n FROM users GROUP BY role, status`).all();
  heading('Accounts');
  for (const row of users) line(`${row.role} · ${row.status}`, row.n);
  const subs = db.prepare(`SELECT plan, status, COUNT(*) AS n FROM subscriptions GROUP BY plan, status`).all();
  heading('Memberships');
  for (const row of subs) line(`${row.plan} · ${row.status}`, row.n);
  heading('Workload');
  for (const table of ['properties', 'staff', 'vehicles', 'trips', 'trip_legs', 'documents', 'expenses', 'tasks', 'reservations', 'ai_conversations', 'tickets', 'audit_events']) {
    if (!hasTable(db, table)) continue;
    line(table, db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n);
  }
  const uploads = fs.existsSync(UPLOADS) ? fs.readdirSync(UPLOADS).filter((entry) => entry !== '.gitkeep').length : 0;
  line('stored upload files', uploads);
  process.stdout.write('\n');
}

function hasTable(db, name) {
  return Boolean(db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(name));
}

/* ------------------------------------------------------------------ counts */

function counts() {
  const db = open({ readonly: true });
  heading('Rows per table');
  let total = 0;
  for (const table of TABLES) {
    if (!hasTable(db, table)) {
      line(table, '— missing —');
      continue;
    }
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
    total += n;
    line(table, n);
  }
  line('total', total);
  process.stdout.write('\n');
}

function users() {
  const db = open({ readonly: true });
  heading('Accounts');
  const rows = db
    .prepare(
      `SELECT u.id, u.email, TRIM(u.first_name || ' ' || u.last_name) AS name, u.role, u.status,
              (SELECT plan || ' / ' || status FROM subscriptions s WHERE s.user_id = u.id) AS membership,
              (SELECT COUNT(*) FROM properties p WHERE p.user_id = u.id) AS residences,
              u.created_at
         FROM users u ORDER BY u.role DESC, u.email`,
    )
    .all();
  if (!rows.length) return fail('No accounts. Run: node scripts/db-cli.mjs seed');
  for (const row of rows) {
    process.stdout.write(
      `  ${row.email.padEnd(34)}${row.role.padEnd(7)}${row.status.padEnd(10)}${String(row.residences).padStart(2)} res  ${row.membership ?? 'no membership'}\n`,
    );
  }
  process.stdout.write('\n  Demo credentials live in db/demo-data.mjs (DEMO_CREDENTIALS).\n\n');
  if (flags.has('--show-credentials')) {
    for (const [name, entry] of Object.entries(DEMO_CREDENTIALS)) process.stdout.write(`    ${name.padEnd(9)} ${entry.email} / ${entry.password}\n`);
    process.stdout.write('\n');
  }
}

/* ------------------------------------------------------------------ seed / reset */

function doSeed({ force = false } = {}) {
  const db = open();
  applySchema(db, ROOT);
  const result = seed(db, { hash, force, cwd: ROOT });
  if (!result.seeded) {
    process.stdout.write(`\n  Nothing done: ${result.users} account(s) already exist. Use --force to wipe and re-seed.\n\n`);
    return;
  }
  heading('Seeded');
  for (const [table, n] of Object.entries(result.counts)) if (n) line(table, n);
  heading('Sign in');
  for (const [name, entry] of Object.entries(DEMO_CREDENTIALS)) {
    line(name, `${entry.email} / ${entry.password}`);
  }
  process.stdout.write('\n  Change these in db/demo-data.mjs. Never reuse them in production.\n\n');
}

function doReset() {
  if (!flags.has('--yes')) fail('reset deletes the database file and every stored upload. Re-run with --yes to confirm.');
  for (const suffix of ['', '-wal', '-shm']) {
    const target = `${DB_PATH}${suffix}`;
    if (fs.existsSync(target)) fs.rmSync(target);
  }
  if (fs.existsSync(UPLOADS)) {
    for (const entry of fs.readdirSync(UPLOADS)) if (entry !== '.gitkeep') fs.rmSync(path.join(UPLOADS, entry), { recursive: true, force: true });
  }
  process.stdout.write('\n  Database and uploads removed. Rebuilding…\n');
  doSeed({ force: true });
}

/* ------------------------------------------------------------------ verify */

function verify() {
  const problems = [];
  const notes = [];
  if (!fs.existsSync(DB_PATH)) fail(`No database at ${DB_PATH}.`);
  const db = open({ readonly: true });

  heading('Structure');
  for (const table of TABLES) {
    if (!hasTable(db, table)) problems.push(`table missing: ${table}`);
  }
  line('tables', problems.length ? 'see below' : `${TABLES.length} present`);

  if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') problems.push('integrity_check did not return ok');
  const fk = db.prepare('PRAGMA foreign_key_check').all();
  if (fk.length) problems.push(`foreign key violations: ${fk.length}`);
  line('integrity', !fk.length && !problems.length ? 'ok' : 'see below');

  heading('Security invariants');
  const weak = db
    .prepare(`SELECT email, substr(password_hash, 1, 7) AS prefix FROM users WHERE password_hash IS NULL OR length(password_hash) < 20 OR password_hash NOT LIKE '$2%'`)
    .all();
  const placeholders = weak.filter((row) => row.prefix === 'unusable:');
  for (const row of placeholders) notes.push(`${row.email}: invited account with no passphrase chosen — by design, it cannot authenticate`);
  for (const row of weak.filter((entry) => entry.prefix !== 'unusable:')) {
    problems.push(`${row.email}: password_hash is not a bcrypt digest (starts “${row.prefix}”)`);
  }
  line('bcrypt digests', weak.length - placeholders.length ? 'FAILED' : `ok (${db.prepare('SELECT COUNT(*) AS n FROM users').get().n} accounts)`);

  const tenants = ['properties', 'staff', 'vehicles', 'trips', 'trip_legs', 'documents', 'expenses', 'tasks', 'reservations', 'ai_conversations', 'ai_messages', 'ai_tasks', 'tickets', 'notifications', 'subscriptions', 'invoices'];
  const missingTenant = [];
  for (const table of tenants) {
    if (!hasTable(db, table)) continue;
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name);
    if (!columns.includes('user_id')) {
      missingTenant.push(table);
      problems.push(`${table} has no user_id column — per-member isolation would be impossible`);
    }
  }
  line('tenant column', missingTenant.length ? 'FAILED' : 'ok on every member-owned table');

  heading('Isolation');
  const orphan = [];
  for (const table of tenants) {
    if (!hasTable(db, table)) continue;
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${table}" t WHERE t.user_id NOT IN (SELECT id FROM users)`).get().n;
    if (n) orphan.push(`${table}: ${n}`);
  }
  if (orphan.length) problems.push(`rows owned by no user — ${orphan.join(', ')}`);
  line('ownership', orphan.length ? 'FAILED' : 'every tenant row maps to an account');

  const crossTalk = db
    .prepare(
      `SELECT COUNT(*) AS n FROM trip_legs l JOIN trips t ON t.id = l.trip_id WHERE l.user_id IS NOT NULL AND t.user_id IS NOT NULL AND l.user_id != t.user_id`,
    )
    .get().n;
  if (crossTalk) problems.push(`${crossTalk} journey step(s) belong to a different member than their journey`);
  line('child/parent owners agree', crossTalk ? 'FAILED' : 'ok');

  heading('Uploads');
  if (hasTable(db, 'documents')) {
    const missing = db.prepare(`SELECT COUNT(*) AS n FROM documents WHERE stored_path IS NOT NULL AND stored_path != ''`).get().n;
    let absent = 0;
    for (const row of db.prepare(`SELECT id, stored_path FROM documents WHERE stored_path IS NOT NULL AND stored_path != ''`).all()) {
      if (!fs.existsSync(path.join(ROOT, row.stored_path))) absent += 1;
    }
    if (absent) problems.push(`${absent} document record(s) point at a file that is not on disk`);
    line('stored files indexed', `${missing} (absent: ${absent})`);
  }

  heading('Demo expectations');
  const expected = { users: 3, properties: 8, staff: 18, vehicles: 6, documents: 17, expenses: 100, tasks: 15 };
  for (const [table, minimum] of Object.entries(expected)) {
    if (!hasTable(db, table)) continue;
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get().n;
    if (n < minimum) notes.push(`${table}: ${n} rows, the demo dataset normally carries ${minimum}+ (fine if you seeded your own data)`);
  }
  line('sample data', notes.filter((note) => note.includes('demo dataset')).length ? 'thin' : 'present');

  process.stdout.write('\n');
  if (notes.length) {
    heading('Notes');
    for (const note of notes) process.stdout.write(`  · ${note}\n`);
    process.stdout.write('\n');
  }
  if (problems.length) {
    heading('Problems');
    for (const problem of problems) process.stdout.write(`  ✗ ${problem}\n`);
    process.stdout.write('\n');
    process.exit(1);
  }
  process.stdout.write('  ✓ Every check passed.\n\n');
}

/* ------------------------------------------------------------------ accounts */

function findByEmail(email) {
  if (!email) fail('Usage: node scripts/db-cli.mjs promote|demote|set-password <email> [password]');
  const db = open();
  const row = db.prepare(`SELECT id, email, role, status FROM users WHERE lower(email) = lower(?)`).get(email);
  if (!row) {
    const known = db.prepare(`SELECT email FROM users ORDER BY email`).all().map((entry) => entry.email).join('\n    ');
    db.close();
    fail(`No account with the address ${email}. Known addresses:\n    ${known}`);
  }
  return { db, row };
}

function setRole(email, role) {
  const { db, row } = findByEmail(email);
  db.prepare(`UPDATE users SET role = ?, updated_at = ? WHERE id = ?`).run(role, new Date().toISOString(), row.id);
  db.prepare(`INSERT INTO audit_events (id, user_id, event, target, meta, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
    `aud_${crypto.randomBytes(8).toString('hex')}`,
    row.id,
    `admin.user_role_changed`,
    row.id,
    JSON.stringify({ via: 'db-cli', role }),
    new Date().toISOString(),
  );
  db.close();
  process.stdout.write(`\n  ${email} is now ${role}.\n\n`);
}

function setPassword(email, plain) {
  if ((plain ?? '').length < 12) fail('A passphrase must be at least 12 characters — the same rule the app enforces.');
  const { db, row } = findByEmail(email);
  const now = new Date().toISOString();
  db.prepare(`UPDATE users SET password_hash = ?, sessions_revoked_at = ?, status = 'active', updated_at = ? WHERE id = ?`).run(hash(plain), now, now, row.id);
  db.prepare(`DELETE FROM password_resets WHERE user_id = ?`).run(row.id);
  db.close();
  process.stdout.write(`\n  Passphrase set for ${email}. Every existing session was revoked, so all devices must sign in again.\n\n`);
}

function invite(email, firstName = 'VELORA', lastName = 'Invite') {
  const probe = open({ readonly: fs.existsSync(DB_PATH) });
  const existing = probe.prepare(`SELECT id FROM users WHERE lower(email) = lower(?)`).get(email);
  probe.close();
  if (existing) fail(`${email} already has an account.`);
  const db = open();
  const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, timezone, locale, currency, briefing_time, notifications_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'owner', 'invited', 'Europe/Paris', 'en-GB', 'EUR', '07:00', '{}', ?, ?)`,
  ).run(id, email.toLowerCase(), `unusable:${crypto.randomBytes(12).toString('base64url')}`, firstName, lastName, now, now);
  db.close();
  process.stdout.write(
    `\n  Invited account created for ${email} with no usable passphrase.\n  In the app, triage the request in /admin/access-requests to get a reset link.\n\n`,
  );
}

/* ------------------------------------------------------------------ export */

function exportFor(email) {
  const db = open({ readonly: true });
  const user = db.prepare(`SELECT id, email, first_name, last_name FROM users WHERE lower(email) = lower(?)`).get(email);
  if (!user) fail(`No account with the address ${email}.`);
  const out = { exportedAt: new Date().toISOString(), account: { ...user }, note: 'Portable copy of everything held against this account.', tables: {} };
  for (const table of TABLES) {
    if (!hasTable(db, table)) continue;
    const columns = db.prepare(`PRAGMA table_info("${table}")`).all().map((column) => column.name);
    if (table === 'users') {
      out.tables[table] = [db.prepare(`SELECT * FROM users WHERE id = ?`).get(user.id)];
      continue;
    }
    if (!columns.includes('user_id')) continue;
    out.tables[table] = db.prepare(`SELECT * FROM "${table}" WHERE user_id = ?`).all(user.id);
  }
  db.close();
  const json = `${JSON.stringify(out, null, 2)}\n`;
  const target = positional[1];
  if (target) {
    fs.writeFileSync(path.resolve(ROOT, target), json);
    process.stdout.write(`\n  Wrote ${target} (${(json.length / 1024).toFixed(0)} KB).\n\n`);
    return;
  }
  process.stdout.write(json);
}

/* ------------------------------------------------------------------ orphans */

function orphans() {
  const db = open({ readonly: true });
  const listed = new Set(
    (hasTable(db, 'documents') ? db.prepare(`SELECT stored_path FROM documents WHERE stored_path IS NOT NULL AND stored_path != ''`).all() : []).map(
      (row) => row.stored_path,
    ),
  );
  const stray = [];
  if (fs.existsSync(UPLOADS)) {
    for (const entry of fs.readdirSync(UPLOADS)) {
      if (entry === '.gitkeep') continue;
      const nested = path.join(UPLOADS, entry);
      const children = fs.statSync(nested).isDirectory() ? fs.readdirSync(nested).map((file) => path.join('data', 'uploads', entry, file)) : [path.join('data', 'uploads', entry)];
      for (const child of children) if (!listed.has(child)) stray.push(child);
    }
  }
  heading('Uploads without a document record');
  if (!stray.length) process.stdout.write('  none\n');
  for (const file of stray) process.stdout.write(`  ${file}\n`);

  heading('Records whose file is missing');
  const absent = [];
  for (const row of db.prepare(`SELECT id, name, stored_path FROM documents WHERE stored_path IS NOT NULL AND stored_path != ''`).all()) {
    if (!fs.existsSync(path.join(ROOT, row.stored_path))) absent.push(row);
  }
  if (!absent.length) process.stdout.write('  none\n');
  for (const row of absent) process.stdout.write(`  ${row.id} · ${row.name} · ${row.stored_path}\n`);
  db.close();

  if (stray.length && flags.has('--fix')) {
    for (const file of stray) fs.rmSync(path.join(ROOT, file), { recursive: true, force: true });
    process.stdout.write(`\n  Removed ${stray.length} unreferenced file(s).\n\n`);
  } else if (stray.length) {
    process.stdout.write('\n  Re-run with --fix to delete the unreferenced files.\n\n');
  } else {
    process.stdout.write('\n');
  }
}

/* ------------------------------------------------------------------ sql */

function rawSql(statement, { write = false } = {}) {
  if (!statement) fail('Usage: node scripts/db-cli.mjs sql "SELECT ..." [--write]');
  const db = open({ readonly: !write });
  const trimmed = statement.trim().replace(/;$/, '');
  if (!write && !/^(select|with|pragma|explain)/i.test(trimmed)) fail('Only reads are allowed without --write.');
  if (write && /^(drop|truncate|delete\s+from\s+users)/i.test(trimmed)) fail('Refusing: use reset for destructive rebuilding.');
  try {
    if (/^(select|with|pragma|explain)/i.test(trimmed)) {
      const rows = db.prepare(trimmed).all();
      if (!rows.length) {
        process.stdout.write('\n  (no rows)\n\n');
        return;
      }
      const columns = Object.keys(rows[0]);
      const width = (key) => Math.max(key.length, ...rows.map((row) => String(row[key] ?? '').length));
      const pads = columns.map((column) => Math.min(38, width(column)));
      process.stdout.write(`\n  ${columns.map((column, index) => column.padEnd(pads[index])).join('  ')}\n`);
      process.stdout.write(`  ${pads.map((pad) => '─'.repeat(pad)).join('  ')}\n`);
      for (const row of rows) {
        process.stdout.write(`  ${columns.map((column, index) => String(row[column] ?? '').slice(0, 38).padEnd(pads[index])).join('  ')}\n`);
      }
      process.stdout.write(`\n  ${rows.length} row(s)\n\n`);
    } else {
      const info = db.prepare(trimmed).run();
      process.stdout.write(`\n  ${Number(info.changes)} row(s) changed.\n\n`);
    }
  } catch (error) {
    fail(error.message);
  } finally {
    db.close();
  }
}

/* ------------------------------------------------------------------ help */

function help() {
  const text = fs.readFileSync(path.join(ROOT, 'scripts', 'db-cli.mjs'), 'utf8');
  const block = [];
  for (const raw of text.split('\n').slice(1)) {
    if (/^\s*\*\//.test(raw)) break;
    block.push(raw.replace(/^ \*\/? ?/, '   ').replace(/\s+$/, ''));
  }
  process.stdout.write(`\n${block.join('\n')}\n\n`);
}

/* ------------------------------------------------------------------ dispatch */

switch (command) {
  case 'status':
    status();
    break;
  case 'counts':
    counts();
    break;
  case 'users':
    users();
    break;
  case 'seed':
    doSeed({ force: flags.has('--force') });
    break;
  case 'reset':
    doReset();
    break;
  case 'verify':
    verify();
    break;
  case 'promote':
    setRole(positional[0], 'admin');
    break;
  case 'demote':
    setRole(positional[0], 'owner');
    break;
  case 'set-password':
    setPassword(positional[0], positional[1]);
    break;
  case 'invite':
    invite(positional[0], positional[1], positional[2]);
    break;
  case 'export':
    exportFor(positional[0]);
    break;
  case 'orphans':
    orphans();
    break;
  case 'sql':
    rawSql(positional[0], { write: flags.has('--write') });
    break;
  case 'help':
  case '--help':
  case '-h':
    help();
    break;
  default:
    fail(`Unknown command "${command}". Run: node scripts/db-cli.mjs help`);
}

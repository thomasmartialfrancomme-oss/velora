/**
 * Shared seeding core — used by both the Next.js runtime (auto-seed on first
 * boot) and `scripts/db-cli.mjs`. Keeping it in one place means the demo data
 * can never diverge between a fresh `npm run dev` and a manual reseed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDemoDataset } from './demo-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

export function readSchema(cwd = path.resolve(here, '..')) {
  return fs.readFileSync(path.join(cwd, 'db', 'schema.sql'), 'utf8');
}

/**
 * Additive columns introduced after the first release. SQLite has no
 * `ADD COLUMN IF NOT EXISTS`, so each is checked against table_info first —
 * that keeps an existing database current without a rebuild.
 */
const COLUMN_PATCHES = [{ table: 'documents', column: 'stored_path', ddl: 'ALTER TABLE documents ADD COLUMN stored_path TEXT' }];

export function applySchema(db, cwd) {
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readSchema(cwd));
  for (const patch of COLUMN_PATCHES) {
    const info = db.prepare(`PRAGMA table_info(${patch.table})`).all();
    if (info.length && !info.some((col) => col.name === patch.column)) db.exec(patch.ddl);
  }
}

const TABLES = [
  'users',
  'properties',
  'staff',
  'vehicles',
  'trips',
  'trip_legs',
  'expense_categories',
  'expenses',
  'tasks',
  'documents',
  'reservations',
  'ai_conversations',
  'ai_messages',
  'ai_tasks',
  'subscriptions',
  'invoices',
  'notifications',
  'access_requests',
  'tickets',
  'audit_events',
  'password_resets',
];

/** Insert one dataset row, dropping keys the table does not define. */
function insertRow(db, table, row) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  const cols = new Set(info.map((c) => c.name));
  const entries = Object.entries(row).filter(([k, v]) => cols.has(k) && v !== undefined);
  if (!entries.length) return;
  const names = entries.map(([k]) => `"${k}"`);
  const params = entries.map(([k]) => `@${k}`);
  // better-sqlite3 binds named parameters from an object keyed WITHOUT the prefix.
  const values = {};
  for (const [k, v] of entries) values[k] = v === null ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v;
  db.prepare(`INSERT OR REPLACE INTO ${table} (${names.join(',')}) VALUES (${params.join(',')})`).run(values);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {{ hash: (plain: string) => string, force?: boolean, cwd?: string }} opts
 */
export function seed(db, { hash, force = false, cwd }) {
  applySchema(db, cwd);
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (existing > 0 && !force) {
    return { seeded: false, users: existing };
  }
  if (force) {
    for (const t of [...TABLES].reverse()) db.exec(`DELETE FROM "${t}"`);
  }

  const ds = buildDemoDataset(new Date());
  const tx = db.transaction(() => {
    for (const u of ds.users) {
      const row = { ...u };
      const plain = row.password;
      delete row.password;
      row.password_hash = hash(plain);
      insertRow(db, 'users', row);
    }
    const rest = { ...ds };
    delete rest.users;
    for (const [table, rows] of Object.entries(rest)) {
      if (!TABLES.includes(table) || !Array.isArray(rows)) continue;
      for (const row of rows) insertRow(db, table, row);
    }
  });
  tx();

  const counts = {};
  for (const t of TABLES) counts[t] = db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
  return { seeded: true, counts };
}

export { TABLES };

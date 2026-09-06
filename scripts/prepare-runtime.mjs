#!/usr/bin/env node
/**
 * Runtime preparation — the first thing a deployed instance needs.
 *
 * Creates the data directories, applies the schema, and (only when explicitly
 * asked) seeds the demonstration households. Idempotent: safe on every boot,
 * every redeploy, and on a machine that already has data.
 *
 *   node scripts/prepare-runtime.mjs                 schema only
 *   VELORA_SEED_DEMO=1 node scripts/prepare-runtime.mjs   + demo accounts
 *
 * Why demo seeding is opt-in: the seeded passphrases are published in the
 * repository. On a host reachable from the internet, seeding them by default
 * would be handing out the front door.
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { applySchema, seed, TABLES } from '../db/seed-core.mjs';
import { DEMO_CREDENTIALS } from '../db/demo-data.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = process.env.VELORA_DB_PATH ? path.resolve(process.env.VELORA_DB_PATH) : path.join(ROOT, 'data', 'velora.db');
const wantDemo = ['1', 'true', 'yes'].includes(String(process.env.VELORA_SEED_DEMO ?? '').toLowerCase());

function log(message) {
  // A closed stdout must never fail a deploy: this runs as Render's
  // preDeployCommand, where a crash would abort the release.
  try {
    process.stdout.write(`[prepare-runtime] ${message}\n`);
  } catch {
    /* ignore */
  }
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'data', 'uploads'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

applySchema(db, ROOT);
log(`schema applied at ${DB_PATH}`);

const users = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
if (users === 0 && wantDemo) {
  const out = seed(db, { hash: (plain) => bcrypt.hashSync(plain, 11), force: false, cwd: ROOT });
  log(`demo dataset written (${Object.values(out.counts).reduce((a, b) => a + b, 0)} rows)`);
  for (const [name, entry] of Object.entries(DEMO_CREDENTIALS)) log(`  ${name}: ${entry.email} / ${entry.password}`);
  if (process.env.NODE_ENV === 'production') {
    log('WARNING: this deployment now carries published demo passphrases. Remove those accounts before real use.');
  }
} else if (users === 0) {
  log('no accounts yet — sign up at /register, or re-run with VELORA_SEED_DEMO=1 for the demonstration data');
} else {
  log(`${users} account(s) already present, nothing seeded`);
}

const counts = TABLES.map((t) => `${t}=${db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n}`).join(' ');
log(counts);
db.close();

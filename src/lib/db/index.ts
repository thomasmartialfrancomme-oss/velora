/**
 * Database access — SQLite (better-sqlite3).
 *
 * Why SQLite here: the brief asks for a product that runs and can be demoed
 * end to end without provisioning a server. Every query in this codebase goes
 * through `sql`` ` / `db.all` / `db.get` with named parameters, and the schema
 * (db/schema.sql) is written in the SQLite/PostgreSQL common subset, so moving
 * to Postgres is a swap of this single file (see README § Database).
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type BetterSqlite3 from 'better-sqlite3';
import { applySchema, seed } from '@db/seed-core.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any */

export type SqlParam = string | number | bigint | Buffer | null;
export type SqlParams = Record<string, unknown> | unknown[];

export interface DatabaseHandle {
  all<T = Record<string, any>>(sql: string, params?: SqlParams): T[];
  get<T = Record<string, any>>(sql: string, params?: SqlParams): T | undefined;
  run(sql: string, params?: SqlParams): { changes: number; lastInsertRowid: number | bigint };
  exec(sql: string): void;
  transaction<T extends (...args: any[]) => any>(fn: T): T;
  pragma(pragma: string): unknown;
  raw(sql: string): BetterSqlite3.Statement;
  close(): void;
  readonly dbPath: string;
}

let handle: DatabaseHandle | null = null;

function resolveDbPath(): string {
  const fromEnv = process.env.VELORA_DB_PATH;
  if (fromEnv && fromEnv.endsWith('.db')) return path.resolve(fromEnv);
  return path.join(process.cwd(), 'data', 'velora.db');
}

function wrap(raw: BetterSqlite3.Database, dbPath: string): DatabaseHandle {
  const named = (params?: SqlParams) => (params === undefined ? {} : params);
  return {
    all: <T,>(sql: string, params?: SqlParams) => raw.prepare(sql).all(named(params)) as T[],
    get: <T,>(sql: string, params?: SqlParams) => raw.prepare(sql).get(named(params)) as T | undefined,
    run: (sql: string, params?: SqlParams) => raw.prepare(sql).run(named(params)),
    exec: (sql: string) => raw.exec(sql),
    transaction: (fn) => raw.transaction(fn as any) as any,
    pragma: (p) => raw.pragma(p),
    raw: (sql) => raw.prepare(sql),
    close: () => raw.close(),
    dbPath,
  };
}

/** Open (and, if needed, migrate + seed) the database. Safe to call anywhere server-side. */
export function getDb(): DatabaseHandle {
  if (handle) return handle;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  // Required at runtime rather than at type time: better-sqlite3 is a native
  // module and must stay out of the bundler.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Database = require('better-sqlite3');
  const raw: BetterSqlite3.Database = new Database(dbPath, { fileMustExist: false });

  applySchema(raw as any, process.cwd());

  const users = (raw.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n;
  if (users === 0) {
    const bcrypt = require('bcryptjs');
    const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
    const result = seed(raw as any, { hash: (plain: string) => bcrypt.hashSync(plain, rounds) });
    if (process.env.NODE_ENV !== 'production') {
      console.info(
        `[velora] seeded demonstration dataset → ${result.seeded ? 'ok' : 'skipped'} · ${dbPath}`,
      );
    }
  }

  handle = wrap(raw, dbPath);
  return handle;
}

/* ------------------------------------------------------------------ ids */

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(9).toString('base64url')}`;
}

export const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------- helpers */

/** `IN (:a, :b, ...)` with named params, safely. */
export function inClause(prefix: string, values: readonly string[]): { sql: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const keys = values.map((v, i) => {
    const key = `${prefix}_${i}`;
    params[key] = v;
    return `@${key}`;
  });
  return { sql: keys.length ? keys.join(', ') : `NULL`, params };
}

/** One row or throw — used where a missing row is a 404, never a silent null. */
export function mustGet<T = Record<string, any>>(sql: string, params?: SqlParams, message = 'Not found'): T {
  const row = getDb().get<T>(sql, params);
  if (!row) throw new NotFoundError(message);
  return row;
}

export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export function countOf(sql: string, params?: SqlParams): number {
  const row = getDb().get<{ n: number | bigint }>(sql, params);
  return Number(row?.n ?? 0);
}

/* ----------------------------------------------------------- audit log */

export function audit(input: {
  userId?: string | null;
  event: string;
  target?: string | null;
  meta?: unknown;
  ipHash?: string | null;
}): void {
  try {
    getDb().run(
      `INSERT INTO audit_events (id, user_id, event, target, meta, ip_hash, created_at)
       VALUES (@id, @user_id, @event, @target, @meta, @ip_hash, @created_at)`,
      {
        id: newId('aud'),
        user_id: input.userId ?? null,
        event: input.event,
        target: input.target ?? null,
        meta: input.meta === undefined ? null : JSON.stringify(input.meta),
        ip_hash: input.ipHash ?? null,
        created_at: nowIso(),
      },
    );
  } catch (error) {
    // Auditing must never take a request down.
    console.error('[velora] audit failed', error);
  }
}

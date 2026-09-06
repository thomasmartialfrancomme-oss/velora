/**
 * A deliberately small data gateway (no ORM, no codegen).
 *
 * Why: the app needs *one* place that guarantees every read and write is
 * scoped to the owning user. Columns are declared per table, so a client can
 * never steer a query with an arbitrary key — unknown keys are dropped before
 * SQL is built, and every value travels as a named parameter.
 */
import { getDb, newId, nowIso } from '@/lib/db';

export type ColumnType = 'text' | 'int' | 'real' | 'bool' | 'json' | 'timestamp';

export interface ColumnDef {
  /** snake_case column name */
  column: string;
  type: ColumnType;
  /** writable from the API layer */
  writable?: boolean;
  default?: unknown;
}

export interface TableSchema {
  table: string;
  idPrefix: string;
  /** camelCase key → column definition */
  columns: Record<string, ColumnDef>;
  /** column set that owns the tenant scope (usually user_id) */
  tenantColumn?: string;
}

type Row = Record<string, unknown>;
export type AnyRow = Row;

function encode(value: unknown, type: ColumnType): unknown {
  if (value === undefined) return null;
  if (value === null) return null;
  switch (type) {
    case 'bool':
      return value ? 1 : 0;
    case 'int': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? Math.round(n) : null;
    }
    case 'real': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'json':
      return typeof value === 'string' ? value : JSON.stringify(value);
    case 'timestamp':
      if (value instanceof Date) return value.toISOString();
      return String(value);
    default:
      return String(value);
  }
}

function decode(value: unknown, type: ColumnType): unknown {
  if (value === null || value === undefined) return null;
  switch (type) {
    case 'bool':
      return Boolean(value);
    case 'int':
      return Number(value);
    case 'real':
      return Number(value);
    case 'json': {
      if (typeof value !== 'string') return value;
      try {
        return JSON.parse(value);
      } catch {
        return [];
      }
    }
    default:
      return value;
  }
}

export class Table<T = Row> {
  constructor(readonly schema: TableSchema) {}

  get name() {
    return this.schema.table;
  }

  /** snake→camel map for building SELECT lists without SELECT * */
  private selectList(): string {
    return Object.entries(this.schema.columns)
      .map(([, def]) => `${def.column} AS "${this.columnToKey(def.column)}"`)
      .join(', ');
  }

  private columnToKey(column: string): string {
    const found = Object.entries(this.schema.columns).find(([, def]) => def.column === column);
    return found ? found[0] : column;
  }

  decorate(row: Row | undefined): T | undefined {
    if (!row) return undefined;
    const out: Row = {};
    for (const [key, def] of Object.entries(this.schema.columns)) {
      out[key] = decode(row[def.column] ?? row[key], def.type);
    }
    return out as T;
  }

  decorateAll(rows: Row[]): T[] {
    return rows.map((row) => this.decorate(row) as T);
  }

  list(opts: { where?: Row; orderBy?: string; limit?: number; userId?: string; extraSql?: string; extraParams?: Row } = {}): T[] {
    const clauses: string[] = [];
    const params: Row = { ...(opts.extraParams ?? {}) };

    if (opts.userId && this.schema.tenantColumn) {
      clauses.push(`${this.schema.tenantColumn} = @tenant`);
      params.tenant = opts.userId;
    }
    for (const [key, value] of Object.entries(opts.where ?? {})) {
      const def = this.schema.columns[key];
      if (!def || value === undefined || key === 'userId') continue;
      if (value === null) {
        clauses.push(`${def.column} IS NULL`);
        continue;
      }
      const param = `w_${key}`;
      clauses.push(`${def.column} = @${param}`);
      params[param] = encode(value, def.type);
    }

    const sql = `SELECT ${this.selectList()} FROM ${this.name}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}${
      opts.extraSql ? ` ${opts.extraSql}` : ''
    }${opts.orderBy ? ` ORDER BY ${safeOrderBy(opts.orderBy, this.schema)}` : ''}${opts.limit ? ` LIMIT ${Math.max(1, Math.min(Number(opts.limit) || 1, 500))}` : ''}`;
    return this.decorateAll(getDb().all<Row>(sql, params as never));
  }

  find(id: string, userId?: string): T | undefined {
    const tenant = userId && this.schema.tenantColumn ? ` AND ${this.schema.tenantColumn} = @tenant` : '';
    const row = getDb().get<Row>(`SELECT ${this.selectList()} FROM ${this.name} WHERE id = @id${tenant}`, {
      id,
      ...(tenant && userId ? { tenant: userId } : {}),
    });
    return this.decorate(row);
  }

  findMany(ids: string[], userId?: string): T[] {
    if (!ids.length) return [];
    const params: Row = {};
    const placeholders = ids.map((id, i) => {
      params[`id${i}`] = id;
      return `@id${i}`;
    });
    const tenant = userId && this.schema.tenantColumn ? ` AND ${this.schema.tenantColumn} = @tenant` : '';
    if (tenant) params.tenant = userId;
    const rows = getDb().all<Row>(
      `SELECT ${this.selectList()} FROM ${this.name} WHERE id IN (${placeholders.join(',')})${tenant}`,
      params as never,
    );
    return this.decorateAll(rows);
  }

  insert(data: Row, userId?: string): T {
    const ts = nowIso();
    const id = (data.id as string) || newId(this.schema.idPrefix);
    const keys = Object.entries(this.schema.columns)
      // Never let a caller write the tenant key or a protected column.
      .filter(([key, def]) => def.writable !== false && key !== 'userId' && data[key] !== undefined)
      .map(([key]) => key);
    const columns = ['id', ...keys.map((k) => this.schema.columns[k]!.column)];
    const values: Row = { id };
    for (const key of keys) {
      const def = this.schema.columns[key]!;
      values[def.column] = encode(data[key], def.type);
    }
    if (this.schema.tenantColumn && !columns.includes(this.schema.tenantColumn) && userId) {
      columns.push(this.schema.tenantColumn);
      values[this.schema.tenantColumn] = userId;
    }
    if (!columns.includes('created_at') && this.hasColumn('created_at')) {
      columns.push('created_at');
      values.created_at = ts;
    }
    if (!columns.includes('updated_at') && this.hasColumn('updated_at')) {
      columns.push('updated_at');
      values.updated_at = ts;
    }

    const placeholders = columns.map((c) => `@${c}`);
    getDb().run(`INSERT INTO ${this.name} (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')})`, values as never);
    return this.find(id, userId) as T;
  }

  update(id: string, patch: Row, userId?: string): T | undefined {
    const existing = this.find(id, userId);
    if (!existing) return undefined;
    const sets: string[] = [];
    const values: Row = { id };
    for (const [key, value] of Object.entries(patch)) {
      const def = this.schema.columns[key];
      if (!def || def.writable === false || value === undefined) continue;
      sets.push(`${def.column} = @${def.column}`);
      values[def.column] = encode(value, def.type);
    }
    if (this.schema.tenantColumn && userId) values.tenant = userId;
    if (!sets.length) return existing;
    if (this.hasColumn('updated_at')) {
      sets.push('updated_at = @updated_at');
      values.updated_at = nowIso();
    }
    const tenant = this.schema.tenantColumn && userId ? ` AND ${this.schema.tenantColumn} = @tenant` : '';
    getDb().run(`UPDATE ${this.name} SET ${sets.join(', ')} WHERE id = @id${tenant}`, values as never);
    return this.find(id, userId);
  }

  delete(id: string, userId?: string): boolean {
    const tenant = this.schema.tenantColumn && userId ? ` AND ${this.schema.tenantColumn} = @tenant` : '';
    const result = getDb().run(`DELETE FROM ${this.name} WHERE id = @id${tenant}`, { id, ...(tenant ? { tenant: userId } : {}) } as never);
    return result.changes > 0;
  }

  count(where: Row = {}, userId?: string): number {
    const clauses: string[] = [];
    const params: Row = {};
    if (userId && this.schema.tenantColumn) {
      clauses.push(`${this.schema.tenantColumn} = @tenant`);
      params.tenant = userId;
    }
    for (const [key, value] of Object.entries(where)) {
      const def = this.schema.columns[key];
      if (!def || value === undefined || key === 'userId') continue;
      clauses.push(`${def.column} = @${def.column}`);
      params[def.column] = encode(value, def.type);
    }
    const row = getDb().get<{ n: number | bigint }>(
      `SELECT COUNT(*) AS n FROM ${this.name}${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''}`,
      params as never,
    );
    return Number(row?.n ?? 0);
  }

  hasColumn(column: string): boolean {
    return Object.values(this.schema.columns).some((def) => def.column === column);
  }
}

/** ORDER BY is the one place raw SQL is assembled; identifiers are validated against the schema. */
function safeOrderBy(input: string, schema: TableSchema): string {
  const direction = /(^|\s)(asc|desc)$/i.test(input) ? (input.trim().split(/\s+/).pop() as string).toUpperCase() : 'ASC';
  const token = input.trim().split(/\s+/)[0]!;
  const allowed = new Set<string>([
    ...Object.values(schema.columns).map((c) => c.column),
    ...Object.keys(schema.columns),
  ]);
  if (!allowed.has(token)) return 'rowid';
  const column = schema.columns[token]?.column ?? token;
  return ['ASC', 'DESC'].includes(direction) ? `${column} ${direction}` : `${column} ASC`;
}

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { PoolClient } from 'pg';

/**
 * HookCode SQL migrations runner (Prisma migrations folder, but without relying on Prisma migrate engine runtime).
 *
 * Business module: Database / Schema Evolution
 * Purpose:
 * - Keep user data safe across open-source upgrades by applying incremental SQL migrations instead of requiring DB wipe.
 *
 * Change record:
 * - 2026-01-15: Introduce `hookcode_schema_migrations` tracking table + "destructive migration" guardrails.
 *
 * Usage:
 * - Called by `ensureSchema()` during backend/worker startup, guarded by a PG advisory lock (see `backend/src/db.ts`).
 *
 * Important notes:
 * - Migrations must be append-only: do NOT modify old `migration.sql` files after release.
 * - Potentially destructive statements are blocked unless explicitly enabled (env: HOOKCODE_DB_ACCEPT_DATA_LOSS=true).
 */

export const HOOKCODE_SCHEMA_MIGRATIONS_TABLE = 'hookcode_schema_migrations';

export interface SqlMigrationFile {
  id: string;
  filePath: string;
  checksumSha256: string;
  statements: string[];
}

export type AppliedMigrationRow = {
  id: string;
  checksum_sha256: string;
  applied_reason: string;
  applied_at: Date;
};

const sha256 = (input: string): string => crypto.createHash('sha256').update(input).digest('hex');

const stripSqlLeadingComments = (input: string): string => {
  // Compatibility note: Prisma migration.sql files often start with "--" comment headers.
  // Some parsing/rewriting logic (baseline checks, idempotent fallbacks) must ignore those headers.
  let s = String(input ?? '');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const trimmed = s.trimStart();
    if (!trimmed) return '';

    // Single-line comments: "-- comment ..."
    if (trimmed.startsWith('--')) {
      const nextLine = trimmed.indexOf('\n');
      if (nextLine === -1) return '';
      s = trimmed.slice(nextLine + 1);
      continue;
    }

    // Block comments: "/* comment */" (rare in our migrations, but safe to support).
    if (trimmed.startsWith('/*')) {
      const end = trimmed.indexOf('*/', 2);
      if (end === -1) return trimmed;
      s = trimmed.slice(end + 2);
      continue;
    }

    return trimmed;
  }
};

export const splitSqlStatements = (input: string): string[] => {
  const sql = input.replace(/\r\n/g, '\n');
  const out: string[] = [];
  let buf = '';
  let inSingle = false;
  let inDouble = false;
  let dollarTag: string | null = null;

  const tryReadDollarTag = (s: string, idx: number): { tag: string; end: number } | null => {
    if (s[idx] !== '$') return null;
    const next = s.indexOf('$', idx + 1);
    if (next <= idx) return null;
    const tag = s.slice(idx, next + 1); // include both '$'
    if (!/^\$[A-Za-z0-9_]*\$$/.test(tag)) return null;
    return { tag, end: next };
  };

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const prev = i > 0 ? sql[i - 1] : '';

    if (!inSingle && !inDouble) {
      const tag = tryReadDollarTag(sql, i);
      if (tag) {
        if (dollarTag === null) {
          dollarTag = tag.tag;
          buf += tag.tag;
          i = tag.end;
          continue;
        }
        if (dollarTag === tag.tag) {
          dollarTag = null;
          buf += tag.tag;
          i = tag.end;
          continue;
        }
      }
    }

    if (dollarTag === null) {
      if (!inDouble && ch === "'" && prev !== '\\') {
        inSingle = !inSingle;
      } else if (!inSingle && ch === '"' && prev !== '\\') {
        inDouble = !inDouble;
      }
    }

    if (!inSingle && !inDouble && dollarTag === null && ch === ';') {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = '';
      continue;
    }

    buf += ch;
  }

  const last = buf.trim();
  if (last) out.push(last);
  return out;
};

export const loadSqlMigrationsFromDir = (migrationsDir: string): SqlMigrationFile[] => {
  if (!fs.existsSync(migrationsDir)) return [];

  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const files: SqlMigrationFile[] = [];
  for (const id of dirs) {
    const filePath = path.join(migrationsDir, id, 'migration.sql');
    if (!fs.existsSync(filePath)) continue;

    const sql = fs.readFileSync(filePath, 'utf8');
    files.push({
      id,
      filePath,
      checksumSha256: sha256(sql),
      statements: splitSqlStatements(sql)
    });
  }
  return files;
};

export const ensureSchemaMigrationsTable = async (client: PoolClient): Promise<void> => {
  // Business intent: Track applied schema migrations so upgrades can be incremental and non-destructive by default.
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${HOOKCODE_SCHEMA_MIGRATIONS_TABLE}" (
      "id" TEXT PRIMARY KEY,
      "checksum_sha256" TEXT NOT NULL,
      "applied_reason" TEXT NOT NULL DEFAULT 'migrate',
      "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
};

export const listAppliedSchemaMigrations = async (client: PoolClient): Promise<Map<string, AppliedMigrationRow>> => {
  const { rows } = await client.query<AppliedMigrationRow>(
    `SELECT id, checksum_sha256, applied_reason, applied_at FROM "${HOOKCODE_SCHEMA_MIGRATIONS_TABLE}" ORDER BY id`
  );
  const map = new Map<string, AppliedMigrationRow>();
  for (const row of rows ?? []) {
    map.set(row.id, row);
  }
  return map;
};

export const recordSchemaMigration = async (
  client: PoolClient,
  migration: Pick<SqlMigrationFile, 'id' | 'checksumSha256'>,
  reason: 'migrate' | 'baseline'
): Promise<void> => {
  // Usage note: Always record inside the same transaction as the migration statements for atomicity.
  await client.query(
    `INSERT INTO "${HOOKCODE_SCHEMA_MIGRATIONS_TABLE}" (id, checksum_sha256, applied_reason) VALUES ($1, $2, $3)`,
    [migration.id, migration.checksumSha256, reason]
  );
};

const queryExists = async (client: PoolClient, sql: string, params: any[]): Promise<boolean> => {
  const { rows } = await client.query<{ exists: boolean }>(sql, params);
  return Boolean(rows?.[0]?.exists);
};

const tableExists = async (client: PoolClient, tableName: string): Promise<boolean> =>
  queryExists(
    client,
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = $1
      ) AS exists
    `,
    [tableName]
  );

const columnExists = async (client: PoolClient, tableName: string, columnName: string): Promise<boolean> =>
  queryExists(
    client,
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [tableName, columnName]
  );

const indexExists = async (client: PoolClient, indexName: string): Promise<boolean> =>
  queryExists(
    client,
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = $1
      ) AS exists
    `,
    [indexName]
  );

const constraintExists = async (client: PoolClient, constraintName: string): Promise<boolean> =>
  queryExists(
    client,
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = 'public'
          AND c.conname = $1
      ) AS exists
    `,
    [constraintName]
  );

export const schemaHasBootstrapTables = async (client: PoolClient): Promise<boolean> => {
  // Business assumption: HookCode schema is present iff core tables exist.
  // Note: Use multiple tables to reduce false positives when DATABASE_URL points to a non-HookCode database.
  const [users, tasks, repositories] = await Promise.all([
    tableExists(client, 'users'),
    tableExists(client, 'tasks'),
    tableExists(client, 'repositories')
  ]);
  return users && tasks && repositories;
};

type SchemaCheck =
  | { kind: 'table'; table: string }
  | { kind: 'column'; table: string; column: string }
  | { kind: 'index'; index: string }
  | { kind: 'constraint'; constraint: string };

const checksFromStatement = (stmt: string): SchemaCheck[] => {
  const s = stripSqlLeadingComments(stmt).trim();
  const out: SchemaCheck[] = [];

  const createTable = s.match(/^CREATE\s+TABLE\s+"([^"]+)"/i);
  if (createTable) {
    out.push({ kind: 'table', table: createTable[1] });
    return out;
  }

  const createIndex = s.match(/^CREATE\s+(?:UNIQUE\s+)?INDEX\s+"([^"]+)"/i);
  if (createIndex) {
    out.push({ kind: 'index', index: createIndex[1] });
    return out;
  }

  const alterTable = s.match(/^ALTER\s+TABLE\s+"([^"]+)"/i);
  if (alterTable) {
    const table = alterTable[1];
    const addColumnRe = /\bADD\s+COLUMN\s+"([^"]+)"/gi;
    for (const match of s.matchAll(addColumnRe)) {
      out.push({ kind: 'column', table, column: match[1] });
    }

    const addConstraint = s.match(/\bADD\s+CONSTRAINT\s+"([^"]+)"/i);
    if (addConstraint) {
      out.push({ kind: 'constraint', constraint: addConstraint[1] });
    }
    return out;
  }

  return out;
};

export const isSqlMigrationLikelyApplied = async (client: PoolClient, migration: SqlMigrationFile): Promise<boolean> => {
  // Pitfall: This heuristic is only used for *legacy databases* that were created before we had a migrations table.
  // Once the tracking table exists, we rely on recorded migration ids + checksums instead of schema probing.
  const checks = migration.statements.flatMap((s) => checksFromStatement(s));
  if (checks.length === 0) return false;

  const strongChecks = checks.filter((c) => c.kind === 'table' || c.kind === 'column');
  const effectiveChecks = strongChecks.length > 0 ? strongChecks : checks;

  // Safety note: Prefer "strong" checks (tables/columns) to reduce false negatives when older DBs are missing
  // non-critical objects (indexes/constraints). This avoids incorrectly treating the DB as empty and re-applying
  // the init migration, which would fail with "relation already exists".
  for (const check of effectiveChecks) {
    if (check.kind === 'table') {
      if (!(await tableExists(client, check.table))) return false;
    } else if (check.kind === 'column') {
      if (!(await columnExists(client, check.table, check.column))) return false;
    } else if (check.kind === 'index') {
      if (!(await indexExists(client, check.index))) return false;
    } else if (check.kind === 'constraint') {
      if (!(await constraintExists(client, check.constraint))) return false;
    }
  }
  return true;
};

export const bootstrapLegacyMigrationRecords = async (
  client: PoolClient,
  migrations: SqlMigrationFile[]
): Promise<string[]> => {
  // Business intent: Allow users to upgrade from older HookCode versions (no tracking table) without wiping their DB.
  const alreadyTracked = await listAppliedSchemaMigrations(client);
  if (alreadyTracked.size > 0) return [];

  const hasSchema = await schemaHasBootstrapTables(client);
  if (!hasSchema) return [];

  const baselined: string[] = [];
  for (const migration of migrations) {
    const likelyApplied = await isSqlMigrationLikelyApplied(client, migration);
    if (!likelyApplied) break;

    await recordSchemaMigration(client, migration, 'baseline');
    baselined.push(migration.id);
  }

  // Pitfall: If the DB is non-empty but the heuristic fails on the first migration, re-applying the init migration
  // would crash with "relation already exists". Baseline the first migration to keep the upgrade path usable, then
  // rely on follow-up migrations (append-only) to bring the schema forward.
  if (baselined.length === 0 && migrations.length > 0) {
    await recordSchemaMigration(client, migrations[0], 'baseline');
    baselined.push(migrations[0].id);
  }
  return baselined;
};

export type DestructiveStatement = {
  statement: string;
  reason: 'DROP_TABLE' | 'DROP_COLUMN' | 'TRUNCATE' | 'DELETE';
};

export const findPotentiallyDestructiveStatements = (statements: string[]): DestructiveStatement[] => {
  // Safety: Be conservative. If we *might* lose user data, require explicit opt-in.
  const out: DestructiveStatement[] = [];
  for (const stmt of statements) {
    const s = stmt.trim();
    if (/\bDROP\s+TABLE\b/i.test(s)) out.push({ statement: stmt, reason: 'DROP_TABLE' });
    if (/\bALTER\s+TABLE\b[\s\S]*\bDROP\s+COLUMN\b/i.test(s)) out.push({ statement: stmt, reason: 'DROP_COLUMN' });
    if (/\bTRUNCATE\b/i.test(s)) out.push({ statement: stmt, reason: 'TRUNCATE' });
    if (/\bDELETE\s+FROM\b/i.test(s)) out.push({ statement: stmt, reason: 'DELETE' });
  }
  return out;
};

export const applySqlMigrations = async (client: PoolClient, migrations: SqlMigrationFile[], options: {
  acceptDataLoss: boolean;
}): Promise<string[]> => {
  const applied: string[] = [];

  const isPgErrorWithCode = (err: unknown): err is { code?: unknown } =>
    typeof err === 'object' && err !== null && 'code' in (err as any);

  const toPgErrorCode = (err: unknown): string | null => {
    if (!isPgErrorWithCode(err)) return null;
    const code = (err as any).code;
    return typeof code === 'string' ? code : code ? String(code) : null;
  };

  const makeAlterTableAddColumnIdempotent = (stmt: string): string | null => {
    // Compatibility note: Some users may have already added a subset of columns (manual SQL / prisma db push).
    // `ALTER TABLE ... ADD COLUMN ...` would then fail with `42701 duplicate_column`. Add "IF NOT EXISTS" so the
    // migration can be safely re-run and only the missing columns are added.
    const sql = stripSqlLeadingComments(stmt);
    if (!/^\s*ALTER\s+TABLE\b/i.test(sql)) return null;
    if (!/\bADD\s+COLUMN\b/i.test(sql)) return null;
    if (/\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/i.test(sql)) return null;
    return sql.replace(/\bADD\s+COLUMN\b/gi, 'ADD COLUMN IF NOT EXISTS');
  };

  const makeCreateTableIdempotent = (stmt: string): string | null => {
    const sql = stripSqlLeadingComments(stmt);
    if (!/^\s*CREATE\s+TABLE\b/i.test(sql)) return null;
    if (/^\s*CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/i.test(sql)) return null;
    return sql.replace(/^\s*CREATE\s+TABLE\b/i, 'CREATE TABLE IF NOT EXISTS');
  };

  const makeCreateIndexIdempotent = (stmt: string): string | null => {
    const sql = stripSqlLeadingComments(stmt);
    if (!/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(sql)) return null;
    if (/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\b/i.test(sql)) return null;
    return sql
      .replace(/^\s*CREATE\s+UNIQUE\s+INDEX\b/i, 'CREATE UNIQUE INDEX IF NOT EXISTS')
      .replace(/^\s*CREATE\s+INDEX\b/i, 'CREATE INDEX IF NOT EXISTS');
  };

  const applyStatement = async (stmt: string): Promise<void> => {
    // Pitfall: In Postgres, any error inside a transaction aborts the whole transaction (until ROLLBACK).
    // We use SAVEPOINT per statement so we can recover from benign/idempotent failures (e.g. duplicate_column)
    // and still keep the migration transaction atomic.
    const savepoint = `hookcode_mig_stmt_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      await client.query(stmt);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return;
    } catch (err) {
      const code = toPgErrorCode(err);
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);

      // 42701: duplicate_column (e.g. "column ... already exists")
      if (code === '42701') {
        const fallback = makeAlterTableAddColumnIdempotent(stmt);
        if (fallback) {
          await client.query(fallback);
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          return;
        }
      }

      // 42P07: duplicate_table (Postgres uses this for "relation already exists", including indexes)
      if (code === '42P07') {
        const fallback = makeCreateTableIdempotent(stmt) ?? makeCreateIndexIdempotent(stmt);
        if (fallback) {
          await client.query(fallback);
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          return;
        }
      }

      // 42710: duplicate_object (commonly for "constraint already exists")
      if (code === '42710') {
        const addConstraint = stmt.match(/\bADD\s+CONSTRAINT\s+"([^"]+)"/i);
        if (addConstraint && (await constraintExists(client, addConstraint[1]))) {
          await client.query(`RELEASE SAVEPOINT ${savepoint}`);
          return;
        }
      }

      throw err;
    }
  };

  for (const migration of migrations) {
    const dangerous = findPotentiallyDestructiveStatements(migration.statements);
    if (dangerous.length > 0 && !options.acceptDataLoss) {
      // Change record: We block destructive migrations by default to protect user data on upgrades.
      const reasons = Array.from(new Set(dangerous.map((d) => d.reason))).join(', ');
      throw new Error(
        `[db] Refusing to apply potentially destructive migration "${migration.id}" (${reasons}) without HOOKCODE_DB_ACCEPT_DATA_LOSS=true. ` +
          `Backup your database and set HOOKCODE_DB_ACCEPT_DATA_LOSS=true to proceed.`
      );
    }

    await client.query('BEGIN');
    try {
      for (const stmt of migration.statements) {
        if (!stmt.trim()) continue;
        await applyStatement(stmt);
      }
      await recordSchemaMigration(client, migration, 'migrate');
      await client.query('COMMIT');
      applied.push(migration.id);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  }

  return applied;
};

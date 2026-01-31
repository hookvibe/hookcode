import dotenv from 'dotenv';
import path from 'path';
import { Pool, type PoolClient } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { isTruthy } from './utils/env';
import {
  applySqlMigrations,
  bootstrapLegacyMigrationRecords,
  ensureSchemaMigrationsTable,
  listAppliedSchemaMigrations,
  loadSqlMigrationsFromDir
} from './db/schemaMigrations';

dotenv.config();

/**
 * Database connection and schema initialization (Prisma):
 * - Business access: via Prisma Client (`db`)
 * - Init/Upgrade: `ensureSchema()` applies pending SQL migrations on startup (safe-by-default; no forced DB wipe)
 *
 * Change record:
 * - 2026-01-15: Upgrade path no longer requires wiping the DB when schema changes; apply migrations incrementally.
 */
const buildDatabaseUrl = (): string => {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.DB_HOST || 'localhost';
  const port = Number(process.env.DB_PORT || 5432);
  const user = process.env.DB_USER || 'hookcode';
  const password = process.env.DB_PASSWORD || 'hookcode';
  const database = process.env.DB_NAME || 'hookcode';

  const url = new URL('postgresql://localhost');
  url.hostname = host;
  url.port = String(port);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
};

process.env.DATABASE_URL = buildDatabaseUrl();

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// pg: if an idle client errors (e.g. DB restart/admin disconnect), the Pool emits an 'error' event;
// if unhandled, the process will crash.
pool.on('error', (err) => {
  console.error('[db] unexpected error on idle client', err);
});

// pg: if an "in-use" client is forcibly disconnected (e.g. admin command/instance restart), the error may bubble from the client;
// add an error listener for each new connection to avoid unhandled 'error' causing a process crash.
pool.on('connect', (client) => {
  client.on('error', (err) => {
    console.error('[db] unexpected error on client', err);
  });
});

const adapter = new PrismaPg(pool);
export const db = new PrismaClient({ adapter });

const resolveDirFromEnv = (value: unknown): string | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  return path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw);
};

type LockRow = { locked: boolean };

const SCHEMA_MIGRATION_LOCK_KEY_1 = 1212367938; // 'HCDB'
const SCHEMA_MIGRATION_LOCK_KEY_2 = 1296648018; // 'MIGR'

const withSchemaMigrationLock = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  // Performance note: Schema migrations are rare and short, so a single global advisory lock is acceptable.
  const client = await pool.connect();
  let hadError = false;
  const onError = (err: unknown) => {
    hadError = true;
    console.warn('[db] schema migration lock connection error', err);
  };
  client.on('error', onError);

  try {
    const { rows } = await client.query<LockRow>('SELECT pg_try_advisory_lock($1, $2) AS locked', [
      SCHEMA_MIGRATION_LOCK_KEY_1,
      SCHEMA_MIGRATION_LOCK_KEY_2
    ]);
    const locked = Boolean(rows?.[0]?.locked);
    if (!locked) {
      console.warn('[db] waiting for schema migration lock (another process is migrating)');
      await client.query('SELECT pg_advisory_lock($1, $2)', [SCHEMA_MIGRATION_LOCK_KEY_1, SCHEMA_MIGRATION_LOCK_KEY_2]);
    }

    try {
      return await fn(client);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1, $2)', [SCHEMA_MIGRATION_LOCK_KEY_1, SCHEMA_MIGRATION_LOCK_KEY_2]);
    }
  } finally {
    try {
      client.release(hadError ? true : undefined);
    } finally {
      try {
        client.removeListener('error', onError);
      } catch (_) {
        // ignore
      }
    }
  }
};

export const ensureSchema = async (): Promise<void> => {
  // Business context: HookCode runs in user-owned environments; a git upgrade should not require data loss.
  // This function ensures the DB schema is upgraded (or blocks safely) before any business query runs.
  const migrationsDir =
    resolveDirFromEnv(process.env.HOOKCODE_MIGRATIONS_DIR) ?? path.join(__dirname, '../prisma/migrations');
  const migrations = loadSqlMigrationsFromDir(migrationsDir);
  if (migrations.length === 0) return;

  const autoMigrate = isTruthy(process.env.HOOKCODE_DB_AUTO_MIGRATE, true);
  const acceptDataLoss = isTruthy(process.env.HOOKCODE_DB_ACCEPT_DATA_LOSS, false);

  await withSchemaMigrationLock(async (client) => {
    await ensureSchemaMigrationsTable(client);

    // Legacy upgrade path: old versions initialized schema without a migrations table; baseline what is already present.
    const baselined = await bootstrapLegacyMigrationRecords(client, migrations);
    if (baselined.length > 0) {
      console.warn(`[db] baselined ${baselined.length} migration(s) from existing schema: ${baselined.join(', ')}`);
    }

    const applied = await listAppliedSchemaMigrations(client);
    for (const migration of migrations) {
      const row = applied.get(migration.id);
      if (!row) continue;
      if (row.checksum_sha256 !== migration.checksumSha256) {
        throw new Error(
          `[db] Migration checksum mismatch for "${migration.id}". Do not edit old migration.sql files after release; create a new migration instead.`
        );
      }
    }

    const pending = migrations.filter((m) => !applied.has(m.id));
    if (pending.length === 0) return;

    if (!autoMigrate) {
      throw new Error(
        `[db] Database schema is out of date (pending migrations: ${pending.map((m) => m.id).join(', ')}). ` +
          `Set HOOKCODE_DB_AUTO_MIGRATE=true to apply automatically and restart.`
      );
    }

    console.warn(`[db] applying ${pending.length} migration(s): ${pending.map((m) => m.id).join(', ')}`);
    await applySqlMigrations(client, pending, { acceptDataLoss });
    console.warn('[db] database schema is up to date');
  });
};

export const pingDb = async () => {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    console.error('[db] ping failed', err);
    return false;
  }
};

// Graceful shutdown timeout for dev mode hot-reload. docs/en/developer/plans/devhotfix20260126/task_plan.md devhotfix20260126
const CLOSE_TIMEOUT_MS = 2000;

export const closeDb = async (): Promise<void> => {
  const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T | void> =>
    Promise.race([
      promise,
      new Promise<void>((resolve) =>
        setTimeout(() => {
          console.warn(`[db] ${label} timed out after ${CLOSE_TIMEOUT_MS}ms, forcing close`);
          resolve();
        }, CLOSE_TIMEOUT_MS)
      )
    ]);

  try {
    await withTimeout(db.$disconnect(), 'prisma disconnect');
  } catch (err) {
    console.warn('[db] prisma disconnect error', err);
  }

  try {
    await withTimeout(pool.end(), 'pool end');
  } catch (err) {
    console.warn('[db] pool end error', err);
  }
};

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { isTruthy } from './utils/env';

dotenv.config();

/**
 * Database connection and schema initialization (Prisma):
 * - Business access: via Prisma Client (`db`)
 * - Init: dev/test can call `ensureSchema()` (runs the init migration on first start/empty DB)
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

const splitSqlStatements = (input: string): string[] => {
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

const loadMigrationSqlFiles = (): string[] => {
  const migrationsDir = resolveDirFromEnv(process.env.HOOKCODE_MIGRATIONS_DIR) ?? path.join(__dirname, '../prisma/migrations');
  const dirs = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));

  const files: string[] = [];
  for (const dir of dirs) {
    const filePath = path.join(migrationsDir, dir, 'migration.sql');
    if (!fs.existsSync(filePath)) continue;
    files.push(filePath);
  }
  return files;
};

const schemaExists = async (): Promise<boolean> => {
  const { rows } = await pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) AS exists
    `
  );
  return Boolean(rows?.[0]?.exists);
};

const schemaIsLatest = async (): Promise<boolean> => {
  const { rows } = await pool.query<{
    has_repo_webhook_verified_at: boolean;
    has_repo_webhook_deliveries: boolean;
    has_repo_repo_provider_credentials: boolean;
    has_repo_model_provider_credentials: boolean;
    has_repo_robot_repo_credential_profile_id: boolean;
    has_repo_robot_repo_credential_source: boolean;
    has_repo_robot_repo_credential_remark: boolean;
    has_repo_robot_token_introspection: boolean;
    has_task_groups: boolean;
    has_task_group_id: boolean;
    has_repo_created_by: boolean;
    has_user_roles: boolean;
    has_user_email_verified: boolean;
    has_email_verification_tokens: boolean;
    has_repo_members: boolean;
    has_repo_access_requests: boolean;
    has_repo_admin_applications: boolean;
  }>(
    `
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repositories'
            AND column_name = 'created_by'
        ) AS has_repo_created_by,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repositories'
            AND column_name = 'webhook_verified_at'
        ) AS has_repo_webhook_verified_at,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'repo_webhook_deliveries'
        ) AS has_repo_webhook_deliveries,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repositories'
            AND column_name = 'repo_provider_credentials_json'
        ) AS has_repo_repo_provider_credentials,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repositories'
            AND column_name = 'model_provider_credentials_json'
        ) AS has_repo_model_provider_credentials,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repo_robots'
            AND column_name = 'repo_credential_profile_id'
          ) AS has_repo_robot_repo_credential_profile_id,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repo_robots'
            AND column_name = 'repo_credential_source'
        ) AS has_repo_robot_repo_credential_source,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repo_robots'
            AND column_name = 'repo_credential_remark'
        ) AS has_repo_robot_repo_credential_remark,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'repo_robots'
            AND column_name = 'repo_token_user_id'
        ) AS has_repo_robot_token_introspection
        ,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'task_groups'
        ) AS has_task_groups,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'tasks'
            AND column_name = 'group_id'
        ) AS has_task_group_id
        ,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'roles'
        ) AS has_user_roles,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'users'
            AND column_name = 'email_verified'
        ) AS has_user_email_verified,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'email_verification_tokens'
        ) AS has_email_verification_tokens,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'repo_members'
        ) AS has_repo_members,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'repo_access_requests'
        ) AS has_repo_access_requests,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'repo_admin_applications'
        ) AS has_repo_admin_applications
    `
  );
  const required = Boolean(
    rows?.[0]?.has_repo_webhook_verified_at &&
      rows?.[0]?.has_repo_webhook_deliveries &&
      rows?.[0]?.has_repo_repo_provider_credentials &&
      rows?.[0]?.has_repo_model_provider_credentials &&
      rows?.[0]?.has_repo_robot_repo_credential_profile_id &&
      rows?.[0]?.has_repo_robot_repo_credential_source &&
      rows?.[0]?.has_repo_robot_repo_credential_remark &&
      rows?.[0]?.has_repo_robot_token_introspection &&
      rows?.[0]?.has_task_groups &&
      rows?.[0]?.has_task_group_id
  );
  if (!required) return false;

  const strict = isTruthy(process.env.HOOKCODE_SCHEMA_STRICT, true);
  if (!strict) return true;

  return Boolean(
    // Removed legacy multi-user/schema fields.
    !rows?.[0]?.has_repo_created_by &&
      !rows?.[0]?.has_user_roles &&
      !rows?.[0]?.has_user_email_verified &&
      !rows?.[0]?.has_email_verification_tokens &&
      !rows?.[0]?.has_repo_members &&
      !rows?.[0]?.has_repo_access_requests &&
      !rows?.[0]?.has_repo_admin_applications
  );
};

export const ensureSchema = async (): Promise<void> => {
  const exists = await schemaExists();
  if (exists) {
    const latest = await schemaIsLatest();
    if (!latest) {
      throw new Error(
        'Database schema has been updated: please wipe the old database (e.g. remove docker volume db_data, or DROP TABLE) and restart the service'
      );
    }
    return;
  }

  const migrationFiles = loadMigrationSqlFiles();
  if (migrationFiles.length === 0) return;

  const statements: string[] = [];
  for (const filePath of migrationFiles) {
    const sql = fs.readFileSync(filePath, 'utf8');
    const parts = splitSqlStatements(sql);
    for (const stmt of parts) statements.push(stmt);
  }
  if (statements.length === 0) return;

  console.warn('[db] schema not found; initializing (first start with empty DB)');
  await pool.query('BEGIN');
  try {
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('[db] schema init failed', err);
    throw err;
  }
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

export const closeDb = async (): Promise<void> => {
  try {
    await db.$disconnect();
  } finally {
    await pool.end();
  }
};

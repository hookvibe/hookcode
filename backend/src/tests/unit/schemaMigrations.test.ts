export {};

import type { PoolClient } from 'pg';
import {
  applySqlMigrations,
  bootstrapLegacyMigrationRecords,
  ensureSchemaMigrationsTable,
  findPotentiallyDestructiveStatements,
  isSqlMigrationLikelyApplied,
  type SqlMigrationFile
} from '../../db/schemaMigrations';

describe('schemaMigrations（Database Migration: Lossless Upgrade）', () => {
  test('findPotentiallyDestructiveStatements: detects risky statements conservatively', () => {
    const out = findPotentiallyDestructiveStatements([
      'DROP TABLE "users"',
      'ALTER TABLE "users" DROP COLUMN "email"',
      'TRUNCATE "tasks"',
      'DELETE FROM "tasks"'
    ]);

    expect(out.map((v) => v.reason)).toEqual(['DROP_TABLE', 'DROP_COLUMN', 'TRUNCATE', 'DELETE']);
  });

  test('isSqlMigrationLikelyApplied: prefers table/column checks over index/constraint checks when available', async () => {
    const query = jest.fn(async (sql: string, params?: any[]) => {
      if (String(sql).includes('information_schema.tables')) {
        // tableExists("users") => true
        return { rows: [{ exists: params?.[0] === 'users' }] };
      }
      if (String(sql).includes('pg_indexes')) {
        // If index checks were executed, this would return false and the migration would be considered not applied.
        return { rows: [{ exists: false }] };
      }
      if (String(sql).includes('pg_constraint')) {
        return { rows: [{ exists: false }] };
      }
      throw new Error(`unexpected query: ${sql}`);
    });

    const client = { query } as unknown as PoolClient;
    const migration: SqlMigrationFile = {
      id: '0001_init',
      filePath: '/tmp/0001_init/migration.sql',
      checksumSha256: 'x',
      statements: [
        'CREATE TABLE "users" ("id" TEXT NOT NULL)',
        'CREATE INDEX "users_username_lower_unique" ON "users" ("id")',
        'ALTER TABLE "users" ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id")'
      ]
    };

    await expect(isSqlMigrationLikelyApplied(client, migration)).resolves.toBe(true);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('information_schema.tables'), ['users']);
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('pg_indexes'), expect.anything());
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('pg_constraint'), expect.anything());
  });

  test('bootstrapLegacyMigrationRecords: baselines already-present migrations and stops at the first missing one', async () => {
    const query = jest.fn(async (sql: string, params?: any[]) => {
      const q = String(sql);

      if (q.includes('CREATE TABLE IF NOT EXISTS "hookcode_schema_migrations"')) {
        return { rows: [] };
      }
      if (q.includes('FROM "hookcode_schema_migrations"')) {
        return { rows: [] };
      }
      if (q.includes('information_schema.tables')) {
        const table = params?.[0];
        if (table === 'users') return { rows: [{ exists: true }] };
        if (table === 'tasks') return { rows: [{ exists: true }] };
        if (table === 'repositories') return { rows: [{ exists: true }] };
        if (table === 'task_groups') return { rows: [{ exists: false }] };
        return { rows: [{ exists: false }] };
      }
      if (q.startsWith('INSERT INTO "hookcode_schema_migrations"')) {
        return { rows: [] };
      }

      throw new Error(`unexpected query: ${sql}`);
    });
    const client = { query } as unknown as PoolClient;

    await ensureSchemaMigrationsTable(client);

    const migrations: SqlMigrationFile[] = [
      {
        id: '0001_init',
        filePath: '/tmp/0001_init/migration.sql',
        checksumSha256: 'sha-1',
        statements: ['CREATE TABLE "users" ("id" TEXT NOT NULL)']
      },
      {
        id: '0002_task_groups',
        filePath: '/tmp/0002_task_groups/migration.sql',
        checksumSha256: 'sha-2',
        statements: ['CREATE TABLE "task_groups" ("id" TEXT NOT NULL)']
      }
    ];

    const baselined = await bootstrapLegacyMigrationRecords(client, migrations);
    expect(baselined).toEqual(['0001_init']);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "hookcode_schema_migrations"'),
      ['0001_init', 'sha-1', 'baseline']
    );
  });

  test('applySqlMigrations: blocks destructive migrations unless acceptDataLoss is enabled', async () => {
    const query = jest.fn(async () => ({ rows: [] }));
    const client = { query } as unknown as PoolClient;
    const migrations: SqlMigrationFile[] = [
      {
        id: '0009_drop_users',
        filePath: '/tmp/0009_drop_users/migration.sql',
        checksumSha256: 'sha-x',
        statements: ['DROP TABLE "users"']
      }
    ];

    await expect(applySqlMigrations(client, migrations, { acceptDataLoss: false })).rejects.toThrow(
      /HOOKCODE_DB_ACCEPT_DATA_LOSS=true/
    );
    expect(query).not.toHaveBeenCalled();
  });

  test('applySqlMigrations: duplicate_column triggers ADD COLUMN IF NOT EXISTS fallback', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
      if (String(sql).startsWith('SAVEPOINT ')) return { rows: [] };
      if (String(sql).startsWith('ROLLBACK TO SAVEPOINT ')) return { rows: [] };
      if (String(sql).startsWith('RELEASE SAVEPOINT ')) return { rows: [] };
      if (String(sql).startsWith('INSERT INTO "hookcode_schema_migrations"')) return { rows: [] };

      if (String(sql).includes('ALTER TABLE "repo_robots"') && !String(sql).includes('IF NOT EXISTS')) {
        const err: any = new Error('column already exists');
        err.code = '42701';
        throw err;
      }

      if (String(sql).includes('ALTER TABLE "repo_robots"') && String(sql).includes('IF NOT EXISTS')) {
        return { rows: [] };
      }

      throw new Error(`unexpected query: ${sql}`);
    });

    const client = { query } as unknown as PoolClient;
    const migrations: SqlMigrationFile[] = [
      {
        id: '20260114000000_repo_robot_credential_source_remark',
        filePath: '/tmp/20260114000000/migration.sql',
        checksumSha256: 'sha-x',
        statements: [
          '-- comment header\nALTER TABLE "repo_robots"\nADD COLUMN "repo_credential_source" TEXT,\nADD COLUMN "repo_credential_remark" TEXT'
        ]
      }
    ];

    await expect(applySqlMigrations(client, migrations, { acceptDataLoss: true })).resolves.toEqual([
      '20260114000000_repo_robot_credential_source_remark'
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ADD COLUMN IF NOT EXISTS'));
  });
});

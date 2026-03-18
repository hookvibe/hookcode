#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
} catch {
  // ignore
}

const WINDOWS_PRISMA_GENERATE_RETRY_MAX = 3;
const WINDOWS_PRISMA_GENERATE_RETRY_DELAY_MS = 250;

// Retry transient Windows Prisma DLL rename locks so backend pretest no longer fails sporadically before Jest even starts. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
const WINDOWS_ENGINE_RENAME_LOCK_PATTERN =
  /EPERM:\s*operation not permitted,\s*rename .*query_engine-windows\.dll\.node\.tmp\d+'.*query_engine-windows\.dll\.node'/i;

const buildDatabaseUrl = (env = process.env) => {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const host = env.DB_HOST || 'localhost';
  const port = Number(env.DB_PORT || 5432);
  const user = env.DB_USER || 'hookcode';
  const password = env.DB_PASSWORD || 'hookcode';
  const database = env.DB_NAME || 'hookcode';

  const url = new URL('postgresql://localhost');
  url.hostname = host;
  url.port = String(port);
  url.username = user;
  url.password = password;
  url.pathname = `/${database}`;
  url.searchParams.set('schema', 'public');
  return url.toString();
};

const ensureDatabaseUrl = (env = process.env) => {
  if (!env.DATABASE_URL) {
    env.DATABASE_URL = buildDatabaseUrl(env);
  }
  return env;
};

const sleepSync = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const resolveGeneratedClientDir = () => {
  try {
    const prismaPackageJson = require.resolve('@prisma/client/package.json', {
      paths: [path.join(__dirname, '..')]
    });
    return path.join(path.dirname(prismaPackageJson), '..', '.prisma', 'client');
  } catch {
    return null;
  }
};

const cleanupStaleQueryEngineTemps = (generatedClientDir = resolveGeneratedClientDir()) => {
  if (!generatedClientDir) return 0;
  let removed = 0;
  try {
    for (const entry of fs.readdirSync(generatedClientDir)) {
      if (!/^query_engine-windows\.dll\.node\.tmp\d+$/.test(entry)) continue;
      try {
        fs.rmSync(path.join(generatedClientDir, entry), { force: true });
        removed += 1;
      } catch {
        // Ignore temp cleanup races because the retry is still valuable without them. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
      }
    }
  } catch {
    return removed;
  }
  return removed;
};

// Resolve Prisma's package bin entrypoint directly so Windows execution does not depend on `.cmd` shim lookup. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
const resolvePrismaCliEntrypoint = () => {
  const prismaPackageJson = require.resolve('prisma/package.json', {
    paths: [path.join(__dirname, '..')]
  });
  const prismaDir = path.dirname(prismaPackageJson);
  const pkg = require(prismaPackageJson);
  const binField = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.prisma;
  if (!binField || typeof binField !== 'string') {
    throw new Error('Unable to resolve Prisma CLI entrypoint');
  }
  return path.join(prismaDir, binField);
};

const shouldRetryGenerateAfterEngineRenameLock = (params) =>
  params.platform === 'win32' &&
  params.command === 'generate' &&
  params.attempt < params.maxAttempts &&
  WINDOWS_ENGINE_RENAME_LOCK_PATTERN.test(String(params.output ?? ''));

const runPrismaCommand = ({ prismaEntrypoint, args, env = process.env }) => {
  const command = String(args[0] ?? '').trim().toLowerCase();
  if (process.platform !== 'win32' || command !== 'generate') {
    const result = spawnSync(process.execPath, [prismaEntrypoint, ...args], {
      stdio: 'inherit',
      env
    });
    return typeof result.status === 'number' ? result.status : 1;
  }

  let lastStatus = 1;
  for (let attempt = 1; attempt <= WINDOWS_PRISMA_GENERATE_RETRY_MAX; attempt += 1) {
    const result = spawnSync(process.execPath, [prismaEntrypoint, ...args], {
      stdio: 'pipe',
      encoding: 'utf8',
      env
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    lastStatus = typeof result.status === 'number' ? result.status : 1;
    if (lastStatus === 0) return 0;

    const combinedOutput = `${result.stderr ?? ''}\n${result.stdout ?? ''}`;
    if (
      !shouldRetryGenerateAfterEngineRenameLock({
        platform: process.platform,
        command,
        output: combinedOutput,
        attempt,
        maxAttempts: WINDOWS_PRISMA_GENERATE_RETRY_MAX
      })
    ) {
      return lastStatus;
    }

    const removedTemps = cleanupStaleQueryEngineTemps();
    console.warn(
      `[prisma-run] retrying Prisma generate after Windows engine rename lock (${attempt}/${WINDOWS_PRISMA_GENERATE_RETRY_MAX - 1})` +
        `${removedTemps ? `; removed ${removedTemps} stale temp file(s)` : ''}.`
    );
    sleepSync(WINDOWS_PRISMA_GENERATE_RETRY_DELAY_MS * attempt);
  }

  return lastStatus;
};

const main = () => {
  ensureDatabaseUrl(process.env);

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/prisma-run.js <prisma args...>');
    process.exit(1);
  }

  const schemaFromEnv = String(process.env.HOOKCODE_PRISMA_SCHEMA_PATH ?? '').trim();
  const hasSchemaArg = args.some((arg) => arg === '--schema' || String(arg).startsWith('--schema='));
  const resolvedSchemaPath = schemaFromEnv
    ? path.isAbsolute(schemaFromEnv)
      ? schemaFromEnv
      : path.join(process.cwd(), schemaFromEnv)
    : null;
  const argsWithSchema = resolvedSchemaPath && !hasSchemaArg ? [...args, '--schema', resolvedSchemaPath] : args;

  const prismaEntrypoint = resolvePrismaCliEntrypoint();
  process.exit(runPrismaCommand({ prismaEntrypoint, args: argsWithSchema, env: process.env }));
};

if (require.main === module) {
  main();
} else {
  module.exports = {
    buildDatabaseUrl,
      cleanupStaleQueryEngineTemps,
      ensureDatabaseUrl,
      resolvePrismaCliEntrypoint,
      shouldRetryGenerateAfterEngineRenameLock
  };
}

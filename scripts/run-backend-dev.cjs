const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildDatabaseUrl } = require('../backend/scripts/database-url.cjs');

const IS_WIN = process.platform === 'win32';
const DEFAULT_BACKEND_ENV_PATH = path.join(__dirname, '..', 'backend', '.env');
const LOCAL_DATABASE_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

// Start backend dev with ADMIN_TOOLS_EMBEDDED disabled in a shell-independent way for Windows and macOS. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
function getPnpmCommand(platform = process.platform) {
  return 'pnpm';
}

function isTruthy(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'y' || raw === 'on';
}

function parseSimpleDotenv(content) {
  const env = {};
  for (const rawLine of String(content || '').split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function readBackendDevEnvFile(envPath = DEFAULT_BACKEND_ENV_PATH) {
  try {
    return parseSimpleDotenv(fs.readFileSync(envPath, 'utf8'));
  } catch {
    return {};
  }
}

function resolveBackendDevEnv({ env = process.env, envPath = DEFAULT_BACKEND_ENV_PATH } = {}) {
  return {
    ...readBackendDevEnvFile(envPath),
    ...env
  };
}

// Resolve the effective source-mode database target from backend/.env plus shell overrides so `pnpm dev:backend` can block accidental shared/prod DB usage before Nest bootstraps a worker. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
function resolveBackendDevDatabaseUrl({ env = process.env, envPath = DEFAULT_BACKEND_ENV_PATH } = {}) {
  return buildDatabaseUrl(resolveBackendDevEnv({ env, envPath }));
}

function isLoopbackDatabaseUrl(databaseUrl) {
  try {
    const parsed = new URL(String(databaseUrl || '').trim());
    return LOCAL_DATABASE_HOSTNAMES.has(parsed.hostname.trim().toLowerCase());
  } catch {
    return false;
  }
}

function assertSafeLocalDevDatabase({ env = process.env, envPath = DEFAULT_BACKEND_ENV_PATH } = {}) {
  const resolvedEnv = resolveBackendDevEnv({ env, envPath });
  if (isTruthy(resolvedEnv.HOOKCODE_ALLOW_REMOTE_DEV_DB)) return;

  const databaseUrl = resolveBackendDevDatabaseUrl({ env: resolvedEnv, envPath });
  if (isLoopbackDatabaseUrl(databaseUrl)) return;

  const parsed = new URL(databaseUrl);
  const target = `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
  throw new Error(
    `[dev:backend] Refusing to start source-mode backend against non-local database ${target}. ` +
      'Point backend/.env at a local DB or set HOOKCODE_ALLOW_REMOTE_DEV_DB=true to override.'
  );
}

// Keep the backend dev entrypoint behavior aligned with the old root script while avoiding shell-specific env syntax. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
function createBackendDevEnv(env = process.env) {
  return {
    ...env,
    ADMIN_TOOLS_EMBEDDED: 'false'
  };
}

function runBackendDev() {
  try {
    assertSafeLocalDevDatabase();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // Use shell on Windows so pnpm.cmd shim is resolved correctly (Node.js v24+ EINVAL fix). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
  const child = spawn(getPnpmCommand(), ['--filter', 'hookcode-backend', 'dev'], {
    stdio: 'inherit',
    env: createBackendDevEnv(),
    shell: IS_WIN
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

if (require.main === module) {
  runBackendDev();
}

module.exports = {
  assertSafeLocalDevDatabase,
  createBackendDevEnv,
  getPnpmCommand,
  isLoopbackDatabaseUrl,
  parseSimpleDotenv,
  readBackendDevEnvFile,
  resolveBackendDevEnv,
  resolveBackendDevDatabaseUrl,
  runBackendDev
};

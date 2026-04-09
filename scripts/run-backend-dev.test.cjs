const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertSafeLocalDevDatabase,
  createBackendDevEnv,
  getPnpmCommand,
  isLoopbackDatabaseUrl,
  parseSimpleDotenv,
  resolveBackendDevDatabaseUrl
} = require('./run-backend-dev.cjs');
const { buildLocalDevDatabaseUrl, buildLocalDevDbDockerArgs, getLocalDevDbConfig } = require('./run-local-dev-db.cjs');
const { createVitestEnv, resolvePackageBinEntrypoint } = require('../frontend/scripts/run-vitest.cjs');

test('getPnpmCommand always returns pnpm (shell: true handles .cmd resolution on Windows)', () => {
  // Since Node v24+ requires shell: true on Windows, getPnpmCommand no longer returns platform-specific names. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
  assert.equal(getPnpmCommand('win32'), 'pnpm');
  assert.equal(getPnpmCommand('darwin'), 'pnpm');
  assert.equal(getPnpmCommand('linux'), 'pnpm');
});

test('createBackendDevEnv forces ADMIN_TOOLS_EMBEDDED=false without dropping existing variables', () => {
  // Preserve inherited environment variables while overriding the backend admin-tools toggle for local dev. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
  const env = createBackendDevEnv({
    PATH: '/tmp/bin',
    ADMIN_TOOLS_EMBEDDED: 'true',
    CUSTOM_FLAG: '1'
  });

  assert.deepEqual(env, {
    PATH: '/tmp/bin',
    ADMIN_TOOLS_EMBEDDED: 'false',
    CUSTOM_FLAG: '1'
  });
});

test('parseSimpleDotenv preserves plain values and quoted strings used by backend/.env', () => {
  const parsed = parseSimpleDotenv(`
DATABASE_URL=postgresql://hookcode:hookcode@127.0.0.1:55432/hookcode_local?schema=public
HOOKCODE_CONSOLE_TASK_URL_PREFIX="http://localhost:5190/#/tasks/"
# Comment
EMPTY=
  `);

  assert.deepEqual(parsed, {
    DATABASE_URL: 'postgresql://hookcode:hookcode@127.0.0.1:55432/hookcode_local?schema=public',
    HOOKCODE_CONSOLE_TASK_URL_PREFIX: 'http://localhost:5190/#/tasks/',
    EMPTY: ''
  });
});

test('resolveBackendDevDatabaseUrl prefers shell env overrides over backend/.env', () => {
  const envPath = path.join(os.tmpdir(), `hookcode-backend-dev-${Date.now()}.env`);
  fs.writeFileSync(
    envPath,
    'DATABASE_URL=postgresql://hookcode:hookcode@127.0.0.1:55432/hookcode_local?schema=public\n'
  );

  const resolved = resolveBackendDevDatabaseUrl({
    envPath,
    env: {
      DATABASE_URL: 'postgresql://hookcode_admin:secret@yuhe.space:7214/hookcode?schema=public'
    }
  });

  assert.equal(resolved, 'postgresql://hookcode_admin:secret@yuhe.space:7214/hookcode?schema=public');
  fs.unlinkSync(envPath);
});

test('isLoopbackDatabaseUrl only treats loopback hosts as safe source-mode dev databases', () => {
  assert.equal(
    isLoopbackDatabaseUrl('postgresql://hookcode:hookcode@127.0.0.1:55432/hookcode_local?schema=public'),
    true
  );
  assert.equal(
    isLoopbackDatabaseUrl('postgresql://hookcode:hookcode@localhost:55432/hookcode_local?schema=public'),
    true
  );
  assert.equal(
    isLoopbackDatabaseUrl('postgresql://hookcode_admin:secret@yuhe.space:7214/hookcode?schema=public'),
    false
  );
});

test('assertSafeLocalDevDatabase blocks non-loopback backend/.env targets unless override is set', () => {
  const envPath = path.join(os.tmpdir(), `hookcode-backend-dev-remote-${Date.now()}.env`);
  fs.writeFileSync(
    envPath,
    'DATABASE_URL=postgresql://hookcode_admin:secret@yuhe.space:7214/hookcode?schema=public\n'
  );

  assert.throws(
    () => assertSafeLocalDevDatabase({ envPath, env: {} }),
    /Refusing to start source-mode backend against non-local database/
  );

  assert.doesNotThrow(() =>
    assertSafeLocalDevDatabase({
      envPath,
      env: { HOOKCODE_ALLOW_REMOTE_DEV_DB: 'true' }
    })
  );

  fs.unlinkSync(envPath);
});

test('getLocalDevDbConfig and helpers keep the local source-mode DB contract explicit', () => {
  const config = getLocalDevDbConfig();
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, '55432');
  assert.equal(config.database, 'hookcode_local');
  assert.equal(
    buildLocalDevDatabaseUrl(config),
    'postgresql://hookcode:hookcode@127.0.0.1:55432/hookcode_local?schema=public'
  );
  assert.deepEqual(buildLocalDevDbDockerArgs(config), [
    'run',
    '-d',
    '--name',
    'hookcode-local-dev-db',
    '--restart',
    'unless-stopped',
    '-e',
    'POSTGRES_DB=hookcode_local',
    '-e',
    'POSTGRES_USER=hookcode',
    '-e',
    'POSTGRES_PASSWORD=hookcode',
    '-p',
    '127.0.0.1:55432:5432',
    '-v',
    'hookcode-local-dev-db-data:/var/lib/postgresql/data',
    'postgres:15-alpine'
  ]);
});

test('resolvePackageBinEntrypoint resolves the Vitest Node entry file instead of relying on .bin shims', () => {
  // Keep the frontend test runner independent from Windows `.cmd` shim lookup by resolving the package bin entry file directly. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
  const vitestEntrypoint = resolvePackageBinEntrypoint('vitest', 'vitest');
  assert.match(vitestEntrypoint, /vitest\.mjs$/);
});

test('createVitestEnv forces NODE_ENV=test without dropping inherited variables', () => {
  // Preserve inherited environment variables while forcing the Vitest runtime flags required by the frontend tests. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
  const env = createVitestEnv({
    PATH: '/tmp/bin',
    NODE_ENV: 'production',
    CUSTOM_FLAG: '1'
  });

  assert.deepEqual(env, {
    PATH: '/tmp/bin',
    NODE_ENV: 'test',
    CUSTOM_FLAG: '1',
    VITE_CJS_IGNORE_WARNING: '1'
  });
});

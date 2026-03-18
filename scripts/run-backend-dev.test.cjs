const test = require('node:test');
const assert = require('node:assert/strict');

const { createBackendDevEnv, getPnpmCommand } = require('./run-backend-dev.cjs');
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

#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const USAGE = `Usage:
  node scripts/update-worker-version.cjs <version> [--skip-lockfile]

Options:
  --skip-lockfile   Skip \`pnpm install --lockfile-only\`
`;

const WORKER_PACKAGE_NAME = '@hookvibe/hookcode-worker';
const repoRoot = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const skipLockfile = argv.includes('--skip-lockfile');
const rawVersion = (argv.find((value) => !value.startsWith('--')) || process.env.HOOKCODE_WORKER_VERSION || '').trim();

if (!rawVersion) {
  console.error('[sync-worker-version] missing worker version\n');
  console.error(USAGE);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(rawVersion)) {
  console.error(`[sync-worker-version] invalid worker version: ${rawVersion}`);
  process.exit(1);
}

const updateFile = (relativePath, updater) => {
  const filePath = path.join(repoRoot, relativePath);
  const before = fs.readFileSync(filePath, 'utf8');
  const after = updater(before);
  if (after === before) return false;
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`[sync-worker-version] updated ${relativePath}`);
  return true;
};

const replaceRequired = (content, pattern, replacer, label) => {
  if (!pattern.test(content)) {
    throw new Error(`[sync-worker-version] could not find ${label}`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacer);
};

const updateBackendPackageJson = () =>
  updateFile('backend/package.json', (content) => {
    const manifest = JSON.parse(content);
    const currentVersion = manifest.dependencies?.[WORKER_PACKAGE_NAME];
    if (!manifest.dependencies || typeof currentVersion !== 'string') {
      throw new Error(`[sync-worker-version] ${WORKER_PACKAGE_NAME} is missing from backend/package.json`);
    }
    manifest.dependencies[WORKER_PACKAGE_NAME] = rawVersion;
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });

const updateWorkerVersionPolicy = () =>
  updateFile('backend/src/modules/workers/worker-version-policy.ts', (content) =>
    replaceRequired(
      content,
      /export const REQUIRED_WORKER_VERSION = '([^']+)';/,
      `export const REQUIRED_WORKER_VERSION = '${rawVersion}';`,
      'REQUIRED_WORKER_VERSION'
    )
  );

const updateDockerEnvExample = () =>
  updateFile('docker/.env.example', (content) =>
    replaceRequired(content, /^HOOKCODE_WORKER_IMAGE_TAG=.*$/m, `HOOKCODE_WORKER_IMAGE_TAG=${rawVersion}`, 'HOOKCODE_WORKER_IMAGE_TAG')
  );

const updateDockerCompose = () =>
  updateFile('docker/docker-compose.yml', (content) =>
    replaceRequired(
      content,
      /(\$\{HOOKCODE_WORKER_IMAGE_TAG:-)([^}]+)(\})/,
      `$1${rawVersion}$3`,
      'docker compose worker image tag'
    )
  );

const updateCiEnvWriter = () =>
  updateFile('docker/ci/write-ci-env.sh', (content) =>
    replaceRequired(
      content,
      /write_kv HOOKCODE_WORKER_IMAGE_TAG "\$\{HOOKCODE_WORKER_IMAGE_TAG:-([^}]+)\}"/,
      `write_kv HOOKCODE_WORKER_IMAGE_TAG "\${HOOKCODE_WORKER_IMAGE_TAG:-${rawVersion}}"`,
      'write-ci-env HOOKCODE_WORKER_IMAGE_TAG'
    )
  );

const changed = [
  updateBackendPackageJson(),
  updateWorkerVersionPolicy(),
  updateDockerEnvExample(),
  updateDockerCompose(),
  updateCiEnvWriter()
].some(Boolean);

if (!skipLockfile) {
  const pnpmExecutable = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const result = spawnSync(pnpmExecutable, ['install', '--lockfile-only'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
  console.log('[sync-worker-version] refreshed pnpm-lock.yaml');
}

if (!changed && skipLockfile) {
  console.log(`[sync-worker-version] no file changes needed for ${rawVersion}`);
}

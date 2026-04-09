#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
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
const isInteractiveTerminal = Boolean(process.stdin.isTTY && process.stdout.isTTY);

const askQuestion = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });

const resolveVersion = async () => {
  const cliOrEnvVersion = (argv.find((value) => !value.startsWith('--')) || process.env.HOOKCODE_WORKER_VERSION || '').trim();
  if (cliOrEnvVersion) {
    return cliOrEnvVersion;
  }

  if (!isInteractiveTerminal) {
    console.error('[sync-worker-version] missing worker version\n');
    console.error(USAGE);
    process.exit(1);
  }

  const answer = String(await askQuestion('请输入 worker 版本号，例如 0.1.4: ')).trim();
  if (!answer) {
    console.error('[sync-worker-version] missing worker version\n');
    console.error(USAGE);
    process.exit(1);
  }

  return answer;
};

const isValidVersion = (version) => /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version);

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

const updateBackendPackageJson = (rawVersion) =>
  updateFile('backend/package.json', (content) => {
    const manifest = JSON.parse(content);
    const currentVersion = manifest.dependencies?.[WORKER_PACKAGE_NAME];
    if (!manifest.dependencies || typeof currentVersion !== 'string') {
      throw new Error(`[sync-worker-version] ${WORKER_PACKAGE_NAME} is missing from backend/package.json`);
    }
    manifest.dependencies[WORKER_PACKAGE_NAME] = rawVersion;
    return `${JSON.stringify(manifest, null, 2)}\n`;
  });

const updateWorkerVersionPolicy = (rawVersion) =>
  updateFile('backend/src/modules/workers/worker-version-policy.ts', (content) =>
    replaceRequired(
      content,
      /export const REQUIRED_WORKER_VERSION = '([^']+)';/,
      `export const REQUIRED_WORKER_VERSION = '${rawVersion}';`,
      'REQUIRED_WORKER_VERSION'
    )
  );

const updateDockerEnvExample = (rawVersion) =>
  updateFile('docker/.env.example', (content) =>
    replaceRequired(content, /^HOOKCODE_WORKER_IMAGE_TAG=.*$/m, `HOOKCODE_WORKER_IMAGE_TAG=${rawVersion}`, 'HOOKCODE_WORKER_IMAGE_TAG')
  );

const updateCiEnvWriter = (rawVersion) =>
  updateFile('docker/ci/write-ci-env.sh', (content) =>
    replaceRequired(
      content,
      /write_kv HOOKCODE_WORKER_IMAGE_TAG "\$\{HOOKCODE_WORKER_IMAGE_TAG:-([^}]+)\}"/,
      `write_kv HOOKCODE_WORKER_IMAGE_TAG "\${HOOKCODE_WORKER_IMAGE_TAG:-${rawVersion}}"`,
      'write-ci-env HOOKCODE_WORKER_IMAGE_TAG'
    )
  );

const main = async () => {
  const rawVersion = await resolveVersion();

  if (!isValidVersion(rawVersion)) {
    console.error(`[sync-worker-version] invalid worker version: ${rawVersion}`);
    process.exit(1);
  }

  const changed = [
    updateBackendPackageJson(rawVersion),
    updateWorkerVersionPolicy(rawVersion),
    updateDockerEnvExample(rawVersion),
    updateCiEnvWriter(rawVersion)
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
};

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});

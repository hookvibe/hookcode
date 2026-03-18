const { spawn } = require('node:child_process');

const IS_WIN = process.platform === 'win32';

// Start backend dev with ADMIN_TOOLS_EMBEDDED disabled in a shell-independent way for Windows and macOS. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
function getPnpmCommand(platform = process.platform) {
  return 'pnpm';
}

// Keep the backend dev entrypoint behavior aligned with the old root script while avoiding shell-specific env syntax. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
function createBackendDevEnv(env = process.env) {
  return {
    ...env,
    ADMIN_TOOLS_EMBEDDED: 'false'
  };
}

function runBackendDev() {
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
  createBackendDevEnv,
  getPnpmCommand,
  runBackendDev
};

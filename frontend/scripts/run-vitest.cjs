const path = require('node:path');
const { spawn } = require('node:child_process');

// Run Vitest with suppressed Vite CJS warnings while preserving exit codes for CI. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
// Use shell on Windows so .cmd shims resolve correctly (Node.js v24+ EINVAL fix). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
const IS_WIN = process.platform === 'win32';
const vitestBin = path.resolve(__dirname, '../node_modules/.bin', 'vitest');
const args = process.argv.slice(2);
const defaultArgs = args.length ? args : ['run'];

const child = spawn(vitestBin, defaultArgs, {
  stdio: 'inherit',
  shell: IS_WIN,
  env: {
    ...process.env,
    // Force React to use the non-production build so `act()` works in Vitest. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    NODE_ENV: 'test',
    VITE_CJS_IGNORE_WARNING: '1'
  }
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

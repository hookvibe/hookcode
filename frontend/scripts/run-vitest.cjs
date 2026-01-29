const path = require('node:path');
const { spawn } = require('node:child_process');

// Run Vitest with suppressed Vite CJS warnings while preserving exit codes for CI. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
const binName = process.platform === 'win32' ? 'vitest.cmd' : 'vitest';
const vitestBin = path.resolve(__dirname, '../node_modules/.bin', binName);
const args = process.argv.slice(2);
const defaultArgs = args.length ? args : ['run'];

const child = spawn(vitestBin, defaultArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_CJS_IGNORE_WARNING: '1'
  }
});

child.on('exit', (code) => {
  process.exit(code ?? 1);
});

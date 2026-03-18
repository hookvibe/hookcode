const { spawn } = require('node:child_process');
const path = require('node:path');

// Run Vitest with suppressed Vite CJS warnings while preserving exit codes for CI. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
// Resolve the Vitest package bin entrypoint instead of `.bin/vitest` so Windows does not depend on `.cmd` shim lookup. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
const resolvePackageBinEntrypoint = (packageName, binName) => {
  const packageJsonPath = require.resolve(`${packageName}/package.json`, { paths: [path.resolve(__dirname, '..')] });
  const packageDir = path.dirname(packageJsonPath);
  const pkg = require(packageJsonPath);
  const binField = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.[binName];
  if (!binField || typeof binField !== 'string') {
    throw new Error(`Unable to resolve ${binName} entrypoint from ${packageName}`);
  }
  return path.resolve(packageDir, binField);
};

const createVitestEnv = (env = process.env) => ({
  ...env,
  // Force React to use the non-production build so `act()` works in Vitest. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  NODE_ENV: 'test',
  VITE_CJS_IGNORE_WARNING: '1'
});

const runVitest = (args = process.argv.slice(2), spawnImpl = spawn) => {
  const defaultArgs = args.length ? args : ['run'];
  const vitestEntrypoint = resolvePackageBinEntrypoint('vitest', 'vitest');
  const child = spawnImpl(process.execPath, [vitestEntrypoint, ...defaultArgs], {
    stdio: 'inherit',
    env: createVitestEnv()
  });

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
};

if (require.main === module) {
  runVitest();
}

module.exports = {
  createVitestEnv,
  resolvePackageBinEntrypoint,
  runVitest
};

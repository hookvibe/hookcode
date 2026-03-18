import path from 'path';
import { normalizeLocalWorkerBackendUrl, resolveInstalledWorkerPackage } from '../../modules/workers/local-worker-supervisor.service';
import { getWorkerVersionRequirement } from '../../modules/workers/worker-version-policy';

describe('normalizeLocalWorkerBackendUrl', () => {
  test('rewrites IPv4 wildcard backend urls to loopback for local worker callbacks', () => {
    // Ensure the local supervised worker never dials 0.0.0.0, which is a listen address rather than a reliable connect target. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    expect(normalizeLocalWorkerBackendUrl('http://0.0.0.0:4000/api')).toBe('http://127.0.0.1:4000/api');
  });

  test('keeps already-routable backend urls unchanged', () => {
    expect(normalizeLocalWorkerBackendUrl('http://127.0.0.1:4000/api')).toBe('http://127.0.0.1:4000/api');
    expect(normalizeLocalWorkerBackendUrl('https://example.com/api')).toBe('https://example.com/api');
  });
});

describe('resolveInstalledWorkerPackage', () => {
  test('returns the installed worker CLI entry and version when the package is resolvable', () => {
    const requiredVersion = getWorkerVersionRequirement().requiredVersion;
    const resolve = (request: string) => {
      expect(request).toBe('@hookvibe/hookcode-worker/package.json');
      return '/tmp/node_modules/@hookvibe/hookcode-worker/package.json';
    };
    const load = (request: string) => {
      expect(request).toBe('/tmp/node_modules/@hookvibe/hookcode-worker/package.json');
      return { version: requiredVersion, bin: { 'hookcode-worker': 'dist/main.js' } };
    };

    expect(resolveInstalledWorkerPackage(resolve as typeof require.resolve, load)).toEqual({
      entryPath: path.resolve('/tmp/node_modules/@hookvibe/hookcode-worker', 'dist/main.js'),
      version: requiredVersion
    });
  });

  test('returns null when the worker package is not installed', () => {
    const resolve = () => {
      throw new Error('missing');
    };

    expect(resolveInstalledWorkerPackage(resolve as unknown as typeof require.resolve)).toBeNull();
  });
});

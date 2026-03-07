import { normalizeLocalWorkerBackendUrl } from '../../modules/workers/local-worker-supervisor.service';

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

// Verify system-worker mode parsing keeps source-mode local workers and Docker/remote bootstrap workers on explicit env-driven paths. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export {};

import { readExternalSystemWorkerConfig, readSystemWorkerMode } from '../../modules/workers/system-worker-config';

describe('system worker config', () => {
  test('defaults to local mode when no mode env is provided', () => {
    expect(readSystemWorkerMode({} as NodeJS.ProcessEnv)).toBe('local');
    expect(readExternalSystemWorkerConfig({} as NodeJS.ProcessEnv)).toBeNull();
  });

  test('parses external mode and returns the configured bootstrap worker payload', () => {
    const env = {
      HOOKCODE_SYSTEM_WORKER_MODE: 'external',
      HOOKCODE_SYSTEM_WORKER_ID: '11111111-1111-4111-8111-111111111111',
      HOOKCODE_SYSTEM_WORKER_TOKEN: 'secret-token',
      HOOKCODE_SYSTEM_WORKER_NAME: 'Configured Remote Worker',
      HOOKCODE_SYSTEM_WORKER_MAX_CONCURRENCY: '3'
    } as NodeJS.ProcessEnv;

    expect(readSystemWorkerMode(env)).toBe('external');
    expect(readExternalSystemWorkerConfig(env)).toEqual({
      workerId: '11111111-1111-4111-8111-111111111111',
      token: 'secret-token',
      name: 'Configured Remote Worker',
      maxConcurrency: 3
    });
  });

  test('rejects missing token in external mode', () => {
    const env = {
      HOOKCODE_SYSTEM_WORKER_MODE: 'external',
      HOOKCODE_SYSTEM_WORKER_ID: '11111111-1111-4111-8111-111111111111'
    } as NodeJS.ProcessEnv;

    expect(() => readExternalSystemWorkerConfig(env)).toThrow(
      'HOOKCODE_SYSTEM_WORKER_TOKEN is required when HOOKCODE_SYSTEM_WORKER_MODE=external'
    );
  });
});

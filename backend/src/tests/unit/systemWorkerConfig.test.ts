// Verify system-worker mode parsing keeps source-mode local workers while production defaults move to manually bound remote workers. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export {};

import { readSystemWorkerMode } from '../../modules/workers/system-worker-config';

describe('system worker config', () => {
  test('defaults to local mode when no mode env is provided', () => {
    expect(readSystemWorkerMode({} as NodeJS.ProcessEnv)).toBe('local');
  });

  test('treats the legacy external mode as disabled', () => {
    const env = {
      HOOKCODE_SYSTEM_WORKER_MODE: 'external'
    } as NodeJS.ProcessEnv;

    expect(readSystemWorkerMode(env)).toBe('disabled');
  });

  test('parses explicit disabled mode', () => {
    const env = {
      HOOKCODE_SYSTEM_WORKER_MODE: 'disabled'
    } as NodeJS.ProcessEnv;

    expect(readSystemWorkerMode(env)).toBe('disabled');
  });
});

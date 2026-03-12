// Verify worker auto-start mode parsing defaults to local source-mode behavior while treating legacy external values as disabled. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
export {};

import { readSystemWorkerMode } from '../../modules/workers/system-worker-config';

describe('system worker config', () => {
  test('defaults to local mode when no mode env is provided', () => {
    expect(readSystemWorkerMode({} as NodeJS.ProcessEnv)).toBe('local');
  });

  test('treats disabled aliases as disabled mode', () => {
    expect(readSystemWorkerMode({ HOOKCODE_SYSTEM_WORKER_MODE: 'disabled' } as NodeJS.ProcessEnv)).toBe('disabled');
    expect(readSystemWorkerMode({ HOOKCODE_SYSTEM_WORKER_MODE: 'off' } as NodeJS.ProcessEnv)).toBe('disabled');
  });

  test('treats legacy external values as disabled mode', () => {
    expect(readSystemWorkerMode({ HOOKCODE_SYSTEM_WORKER_MODE: 'external' } as NodeJS.ProcessEnv)).toBe('disabled');
    expect(readSystemWorkerMode({ HOOKCODE_SYSTEM_WORKER_MODE: 'remote' } as NodeJS.ProcessEnv)).toBe('disabled');
  });
});

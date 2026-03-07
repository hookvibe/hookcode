// Cover worker env parsing so remote bootstrap settings stay deterministic. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
import { homedir } from 'os';
import path from 'path';
import { buildWorkerWsUrl, parseWorkerConfig } from '../config';

describe('worker config', () => {
  test('parses worker env and normalizes backend url', () => {
    const config = parseWorkerConfig({
      HOOKCODE_BACKEND_URL: 'https://example.com/api/',
      HOOKCODE_WORKER_ID: 'worker-1',
      HOOKCODE_WORKER_TOKEN: 'secret',
      HOOKCODE_WORKER_KIND: 'remote',
      HOOKCODE_WORKER_NAME: 'Remote A',
      HOOKCODE_WORKER_MAX_CONCURRENCY: '3'
    });

    expect(config.backendUrl).toBe('https://example.com/api');
    expect(config.workerKind).toBe('remote');
    expect(config.maxConcurrency).toBe(3);
    expect(config.runtimeInstallDir).toBe(path.join(homedir(), '.hookcode', 'runtime'));
  });

  test('builds websocket url from backend api url', () => {
    expect(buildWorkerWsUrl('https://example.com/api', 'worker-1', 'token')).toBe(
      'wss://example.com/api/workers/connect?workerId=worker-1&token=token'
    );
  });

  test('uses noop and unified work dir defaults', () => {
    const config = parseWorkerConfig({
      HOOKCODE_BACKEND_URL: 'http://localhost:3000/api',
      HOOKCODE_WORKER_ID: 'worker-1',
      HOOKCODE_WORKER_TOKEN: 'secret',
      HOOKCODE_WORKER_NOOP_ON_MISSING_COMMAND: 'true'
    });

    expect(config.noopOnMissingCommand).toBe(true);
    expect(config.runtimeInstallDir).toBe(path.join(homedir(), '.hookcode', 'runtime'));
    expect(config.workspaceRootDir).toBe(path.join(homedir(), '.hookcode', 'workspaces'));
  });

  test('derives runtime and workspace directories from HOOKCODE_WORK_DIR', () => {
    const config = parseWorkerConfig({
      HOOKCODE_BACKEND_URL: 'http://localhost:3000/api',
      HOOKCODE_WORKER_ID: 'worker-1',
      HOOKCODE_WORKER_TOKEN: 'secret',
      HOOKCODE_WORK_DIR: '~/custom-hookcode-root'
    });

    expect(config.runtimeInstallDir).toBe(path.join(homedir(), 'custom-hookcode-root', 'runtime'));
    expect(config.workspaceRootDir).toBe(path.join(homedir(), 'custom-hookcode-root', 'workspaces'));
  });
});

// Verify worker startup keeps retrying instead of exiting when the first websocket dial fails. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
const sockets: MockWebSocket[] = [];

class MockWebSocket {
  static OPEN = 1;
  readyState = 0;
  handlers = new Map<string, Array<(...args: any[]) => void>>();

  constructor(_url: string) {
    sockets.push(this);
  }

  on(event: string, handler: (...args: any[]) => void) {
    const next = this.handlers.get(event) ?? [];
    next.push(handler);
    this.handlers.set(event, next);
    return this;
  }

  once(event: string, handler: (...args: any[]) => void) {
    const wrapper = (...args: any[]) => {
      this.off(event, wrapper);
      handler(...args);
    };
    return this.on(event, wrapper);
  }

  off(event: string, handler: (...args: any[]) => void) {
    const next = (this.handlers.get(event) ?? []).filter((current) => current !== handler);
    this.handlers.set(event, next);
    return this;
  }

  emit(event: string, ...args: any[]) {
    for (const handler of this.handlers.get(event) ?? []) {
      handler(...args);
    }
  }

  send() {
    return undefined;
  }
}

jest.mock('ws', () => ({
  __esModule: true,
  default: MockWebSocket
}));

import { WorkerProcess } from '../workerProcess';

describe('WorkerProcess.start', () => {
  beforeEach(() => {
    sockets.length = 0;
    jest.restoreAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('resolves startup and schedules reconnect when the first websocket attempt closes before open', async () => {
    const worker = new WorkerProcess({
      backendUrl: 'http://127.0.0.1:4000/api',
      wsUrl: 'ws://127.0.0.1:4000/api/workers/connect?workerId=w1&token=t1',
      workerId: 'w1',
      workerToken: 't1',
      workerName: 'Test Worker',
      workerKind: 'local',
      preview: true,
      heartbeatIntervalMs: 10_000,
      maxConcurrency: 1,
      runtimeInstallDir: '/tmp/hookcode-runtime',
      workspaceRootDir: '/tmp/hookcode-workspaces',
      reconnectMinMs: 100,
      reconnectMaxMs: 1_000,
      controlPollIntervalMs: 2_000,
      cancelKillTimeoutMs: 5_000,
      noopOnMissingCommand: false
    });

    const startPromise = worker.start();
    expect(sockets).toHaveLength(1);

    sockets[0].emit('error', new Error('ECONNREFUSED'));
    sockets[0].emit('close');
    await startPromise;

    await jest.advanceTimersByTimeAsync(100);
    expect(sockets).toHaveLength(2);
  });
});

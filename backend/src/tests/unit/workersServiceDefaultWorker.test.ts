// Verify default worker fallback prefers reachable system workers so Docker/production can use external executors without stale local rows blocking new tasks. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export {};

jest.mock('../../db', () => ({
  db: {
    taskGroup: { findUnique: jest.fn() },
    repoRobot: { findUnique: jest.fn() },
    worker: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    task: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() }
  }
}));

import { db } from '../../db';
import { WorkersService } from '../../modules/workers/workers.service';
import { getWorkerVersionRequirement } from '../../modules/workers/worker-version-policy';

describe('WorkersService default worker routing', () => {
  const compatibleWorkerVersion = getWorkerVersionRequirement().requiredVersion;
  const logWriter = {
    logSystem: jest.fn(),
    logExecution: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.worker.findFirst as jest.Mock).mockReset();
    (db.worker.findMany as jest.Mock).mockReset();
    (db.taskGroup.findUnique as jest.Mock).mockReset();
    (db.repoRobot.findUnique as jest.Mock).mockReset();
    (db.taskGroup.findUnique as jest.Mock).mockResolvedValue(null);
    (db.repoRobot.findUnique as jest.Mock).mockResolvedValue(null);
  });

  test('prefers the configured global default worker before any local fallback', async () => {
    (db.worker.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: '11111111-1111-4111-8111-111111111111' })
      .mockResolvedValueOnce(null);

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBe('11111111-1111-4111-8111-111111111111');
  });

  test('falls back to the local system worker when no global default worker is configured', async () => {
    (db.worker.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: '22222222-2222-4222-8222-222222222222' });

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBe('22222222-2222-4222-8222-222222222222');
  });

  test('marks stale online workers offline during startup reconciliation', async () => {
    (db.worker.findMany as jest.Mock).mockResolvedValue([
      { id: 'stale-worker', lastSeenAt: new Date('2026-04-09T00:00:00.000Z') },
      { id: 'fresh-worker', lastSeenAt: new Date('2026-04-09T00:00:50.000Z') }
    ]);

    const service = new WorkersService(logWriter as any);
    const markOfflineSpy = jest.spyOn(service, 'markWorkerOffline').mockResolvedValue(undefined);

    await expect(service.reconcileStaleWorkers(new Date('2026-04-09T00:01:00.000Z'))).resolves.toBe(1);
    expect(markOfflineSpy).toHaveBeenCalledWith('stale-worker', 'startup_stale_reconcile');
    expect(markOfflineSpy).not.toHaveBeenCalledWith('fresh-worker', expect.anything());
  });

  test('blocks task creation when the selected provider is not available on the worker machine', async () => {
    (db.worker.findUnique as jest.Mock).mockResolvedValue({
      status: 'online',
      disabledAt: null,
      name: 'remote-1',
      version: compatibleWorkerVersion,
      lastSeenAt: new Date(),
      runtimeState: {
        providerStatuses: {
          claude_code: { status: 'ready' }
        }
      },
      capabilities: { providers: ['claude_code'] }
    });

    const service = new WorkersService(logWriter as any);
    await expect(service.requireWorkerReadyForNewTask('worker-1', 'codex')).resolves.toEqual({
      ok: false,
      code: 'WORKER_PROVIDER_NOT_READY',
      message: 'Codex is not available in remote-1\'s environment. Install or configure the global Codex CLI on that machine before starting the task.'
    });
  });

  test('accepts task creation when the selected provider is available in the environment', async () => {
    (db.worker.findUnique as jest.Mock).mockResolvedValue({
      status: 'online',
      disabledAt: null,
      name: 'remote-1',
      version: compatibleWorkerVersion,
      lastSeenAt: new Date(),
      runtimeState: {
        providerStatuses: {
          codex: { status: 'ready' }
        }
      },
      capabilities: { providers: ['codex'] }
    });

    const service = new WorkersService(logWriter as any);
    await expect(service.requireWorkerReadyForNewTask('worker-1', 'codex')).resolves.toEqual({ ok: true });
  });
});

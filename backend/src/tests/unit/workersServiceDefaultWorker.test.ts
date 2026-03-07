// Verify default worker fallback prefers reachable system workers so Docker/production can use external executors without stale local rows blocking new tasks. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export {};

jest.mock('../../db', () => ({
  db: {
    taskGroup: { findUnique: jest.fn() },
    repoRobot: { findUnique: jest.fn() },
    worker: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    task: { findMany: jest.fn(), update: jest.fn(), updateMany: jest.fn() }
  }
}));

import { db } from '../../db';
import { WorkersService } from '../../modules/workers/workers.service';

describe('WorkersService default worker routing', () => {
  const logWriter = {
    logSystem: jest.fn(),
    logExecution: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.taskGroup.findUnique as jest.Mock).mockResolvedValue(null);
    (db.repoRobot.findUnique as jest.Mock).mockResolvedValue(null);
  });

  test('prefers an online external system worker when the local system worker is offline', async () => {
    // Keep Docker/production routing on the reachable external system worker even if a stale local row still exists in the shared DB. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    (db.worker.findMany as jest.Mock).mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', kind: 'local', status: 'offline' },
      { id: '11111111-1111-4111-8111-111111111111', kind: 'remote', status: 'online' }
    ]);

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBe('11111111-1111-4111-8111-111111111111');
  });

  test('falls back to the local system worker when both local and remote workers are online', async () => {
    (db.worker.findMany as jest.Mock).mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', kind: 'local', status: 'online' },
      { id: '11111111-1111-4111-8111-111111111111', kind: 'remote', status: 'online' }
    ]);

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBe('22222222-2222-4222-8222-222222222222');
  });
});

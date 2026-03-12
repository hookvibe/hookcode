// Verify fallback worker routing only auto-picks online workers and leaves deployments unconfigured when every worker is offline. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
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

  test('prefers an online remote worker when the local worker is offline', async () => {
    (db.worker.findMany as jest.Mock).mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', kind: 'local', status: 'offline' },
      { id: '11111111-1111-4111-8111-111111111111', kind: 'remote', status: 'online' }
    ]);

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBe('11111111-1111-4111-8111-111111111111');
  });

  test('prefers an online local worker when both local and remote workers are online', async () => {
    (db.worker.findMany as jest.Mock).mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', kind: 'local', status: 'online' },
      { id: '11111111-1111-4111-8111-111111111111', kind: 'remote', status: 'online' }
    ]);

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBe('22222222-2222-4222-8222-222222222222');
  });

  test('returns null when every discovered worker is offline', async () => {
    (db.worker.findMany as jest.Mock).mockResolvedValue([
      { id: '22222222-2222-4222-8222-222222222222', kind: 'local', status: 'offline' },
      { id: '11111111-1111-4111-8111-111111111111', kind: 'remote', status: 'offline' }
    ]);

    const service = new WorkersService(logWriter as any);
    await expect(service.findEffectiveWorkerId({})).resolves.toBeNull();
  });
});

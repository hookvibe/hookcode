// Verify local worker registration reuses one local row while keeping worker metadata limited to runtime and routing fields. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
export {};

jest.mock('../../db', () => ({
  db: {
    worker: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findUnique: jest.fn(), delete: jest.fn() }
  }
}));

import { db } from '../../db';
import { WorkersService } from '../../modules/workers/workers.service';

describe('WorkersService local worker lifecycle', () => {
  const logWriter = {
    logSystem: jest.fn(),
    logExecution: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reuses the first local worker row when source-mode auto-start runs again', async () => {
    (db.worker.findFirst as jest.Mock).mockResolvedValue({
      id: 'local-1',
      name: 'Old Local Worker',
      kind: 'local',
      status: 'online',
      maxConcurrency: 2,
      currentConcurrency: 1,
      capabilities: { preview: true },
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z')
    });
    (db.worker.update as jest.Mock).mockResolvedValue({
      id: 'local-1',
      name: 'Local Backend Worker',
      kind: 'local',
      status: 'offline',
      maxConcurrency: 2,
      currentConcurrency: 0,
      capabilities: { preview: true },
      backendBaseUrl: 'http://127.0.0.1:4000/api',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:01:00.000Z')
    });

    const service = new WorkersService(logWriter as any);
    const result = await service.ensureLocalWorker({
      name: 'Local Backend Worker',
      backendBaseUrl: 'http://127.0.0.1:4000/api',
      maxConcurrency: 2
    });

    expect(db.worker.findFirst).toHaveBeenCalledWith({ where: { kind: 'local' }, orderBy: { createdAt: 'asc' } });
    expect(db.worker.update).toHaveBeenCalledWith({
      where: { id: 'local-1' },
      data: expect.objectContaining({
        name: 'Local Backend Worker',
        status: 'offline',
        currentConcurrency: 0,
        backendBaseUrl: 'http://127.0.0.1:4000/api'
      })
    });
    expect(result.worker).toEqual(expect.objectContaining({ id: 'local-1', kind: 'local', status: 'offline' }));
    expect(result.token).toEqual(expect.any(String));
  });

  test('refuses to delete local workers through the remote-worker admin API', async () => {
    (db.worker.findUnique as jest.Mock).mockResolvedValue({ id: 'local-1', kind: 'local' });

    const service = new WorkersService(logWriter as any);
    await expect(service.deleteWorker('local-1')).resolves.toBe(false);
    expect(db.worker.delete).not.toHaveBeenCalled();
  });
});

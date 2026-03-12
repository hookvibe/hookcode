// Verify external worker binding only claims an existing credential-matched remote worker instead of auto-creating one. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
export {};

jest.mock('../../db', () => ({
  db: {
    worker: { findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() }
  }
}));

import { createHash } from 'crypto';
import { db } from '../../db';
import { WorkersService } from '../../modules/workers/workers.service';

const hashWorkerToken = (token: string): string => createHash('sha256').update(token).digest('hex');

describe('WorkersService external worker binding', () => {
  const logWriter = {
    logSystem: jest.fn(),
    logExecution: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.worker.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
  });

  test('binds an existing remote worker when id and token match', async () => {
    // Keep existing worker identity fields intact while backend claims the row for default external routing. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
    (db.worker.findUnique as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Configured Remote Worker',
      kind: 'remote',
      status: 'online',
      systemManaged: false,
      tokenHash: hashWorkerToken('secret-token'),
      maxConcurrency: 3,
      currentConcurrency: 1,
      capabilities: { preview: false },
      backendBaseUrl: null,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      disabledAt: null
    });
    (db.worker.update as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Configured Remote Worker',
      kind: 'remote',
      status: 'offline',
      systemManaged: true,
      tokenHash: hashWorkerToken('secret-token'),
      maxConcurrency: 3,
      currentConcurrency: 0,
      capabilities: { preview: false },
      backendBaseUrl: 'http://127.0.0.1:4000/api',
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:01:00.000Z'),
      disabledAt: null
    });

    const service = new WorkersService(logWriter as any);
    const result = await service.bindExternalSystemWorker({
      workerId: '11111111-1111-4111-8111-111111111111',
      token: 'secret-token',
      backendBaseUrl: 'http://127.0.0.1:4000/api'
    });

    expect(db.worker.updateMany).toHaveBeenCalledWith({
      where: { kind: 'remote', systemManaged: true, id: { not: '11111111-1111-4111-8111-111111111111' } },
      data: expect.objectContaining({ systemManaged: false })
    });
    expect(db.worker.update).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111' },
      data: expect.objectContaining({
        systemManaged: true,
        status: 'offline',
        currentConcurrency: 0,
        backendBaseUrl: 'http://127.0.0.1:4000/api'
      })
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Configured Remote Worker',
        systemManaged: true,
        status: 'offline',
        maxConcurrency: 3
      })
    );
    expect(logWriter.logSystem).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'WORKER_SYSTEM_EXTERNAL_BOUND' })
    );
  });

  test('rejects missing configured worker rows', async () => {
    (db.worker.findUnique as jest.Mock).mockResolvedValue(null);

    const service = new WorkersService(logWriter as any);
    await expect(
      service.bindExternalSystemWorker({
        workerId: '11111111-1111-4111-8111-111111111111',
        token: 'secret-token'
      })
    ).rejects.toThrow('Configured external system worker not found: 11111111-1111-4111-8111-111111111111');
  });

  test('rejects token mismatches for existing workers', async () => {
    (db.worker.findUnique as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Configured Remote Worker',
      kind: 'remote',
      status: 'offline',
      systemManaged: false,
      tokenHash: hashWorkerToken('different-token'),
      maxConcurrency: 1,
      currentConcurrency: 0,
      capabilities: { preview: false },
      backendBaseUrl: null,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
      updatedAt: new Date('2026-03-12T00:00:00.000Z'),
      disabledAt: null
    });

    const service = new WorkersService(logWriter as any);
    await expect(
      service.bindExternalSystemWorker({
        workerId: '11111111-1111-4111-8111-111111111111',
        token: 'secret-token'
      })
    ).rejects.toThrow('Configured external system worker token mismatch: 11111111-1111-4111-8111-111111111111');
  });
});

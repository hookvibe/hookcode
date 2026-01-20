jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    $transaction: jest.fn()
  }
}));

import { db } from '../../db';
import { RepositoryService } from '../../modules/repositories/repository.service';

describe('RepositoryService archive/unarchive', () => {
  const service = new RepositoryService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('archiveRepo sets archivedAt and cascades to tasks/task groups', async () => {
    // Use a fixed time so `archivedAt` is deterministic in assertions. qnp1mtxhzikhbi0xspbc
    jest.useFakeTimers().setSystemTime(new Date('2026-01-20T00:00:00.000Z'));

    const tx: any = {
      repository: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      task: { updateMany: jest.fn() },
      taskGroup: { updateMany: jest.fn() }
    };

    const now = new Date();
    const baseRow = {
      id: 'r1',
      provider: 'gitlab',
      name: 'group/project',
      externalId: null,
      apiBaseUrl: null,
      webhookVerifiedAt: null,
      branches: null,
      enabled: true,
      archivedAt: null,
      createdAt: now,
      updatedAt: now
    };

    tx.repository.findUnique
      .mockResolvedValueOnce(baseRow)
      .mockResolvedValueOnce({ ...baseRow, archivedAt: now, updatedAt: now });
    tx.repository.update.mockResolvedValue({ ...baseRow, archivedAt: now, updatedAt: now });
    tx.task.updateMany.mockResolvedValue({ count: 3 });
    tx.taskGroup.updateMany.mockResolvedValue({ count: 2 });

    (db.$transaction as any).mockImplementation(async (fn: any) => fn(tx));

    const result = await service.archiveRepo('r1', { id: 'u1' });

    expect(result?.repo.archivedAt).toBe(now.toISOString());
    expect(result?.tasksArchived).toBe(3);
    expect(result?.taskGroupsArchived).toBe(2);

    jest.useRealTimers();
  });

  test('unarchiveRepo clears archivedAt and cascades restore to tasks/task groups', async () => {
    // Use a fixed time so `archivedAt` updates are deterministic in assertions. qnp1mtxhzikhbi0xspbc
    jest.useFakeTimers().setSystemTime(new Date('2026-01-20T00:00:00.000Z'));

    const tx: any = {
      repository: {
        findUnique: jest.fn(),
        update: jest.fn()
      },
      task: { updateMany: jest.fn() },
      taskGroup: { updateMany: jest.fn() }
    };

    const now = new Date();
    const baseRow = {
      id: 'r1',
      provider: 'gitlab',
      name: 'group/project',
      externalId: null,
      apiBaseUrl: null,
      webhookVerifiedAt: null,
      branches: null,
      enabled: true,
      archivedAt: now,
      createdAt: now,
      updatedAt: now
    };

    tx.repository.findUnique
      .mockResolvedValueOnce(baseRow)
      .mockResolvedValueOnce({ ...baseRow, archivedAt: null, updatedAt: now });
    tx.repository.update.mockResolvedValue({ ...baseRow, archivedAt: null, updatedAt: now });
    tx.task.updateMany.mockResolvedValue({ count: 10 });
    tx.taskGroup.updateMany.mockResolvedValue({ count: 4 });

    (db.$transaction as any).mockImplementation(async (fn: any) => fn(tx));

    const result = await service.unarchiveRepo('r1', { id: 'u1' });

    expect(result?.repo.archivedAt).toBeUndefined();
    expect(result?.tasksRestored).toBe(10);
    expect(result?.taskGroupsRestored).toBe(4);

    jest.useRealTimers();
  });
});


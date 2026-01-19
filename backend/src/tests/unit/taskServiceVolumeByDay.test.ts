jest.mock('../../db', () => ({
  __esModule: true,
  db: {
    task: { findMany: jest.fn(), groupBy: jest.fn() },
    $queryRaw: jest.fn(),
    repository: { findMany: jest.fn() },
    repoRobot: { findMany: jest.fn() }
  }
}));

import { db } from '../../db';
import { TaskService } from '../../modules/tasks/task.service';

// Unit tests for TaskService.getTaskVolumeByDay used by the repo dashboard trend chart. dashtrendline20260119m9v2

describe('TaskService.getTaskVolumeByDay', () => {
  const taskService = new TaskService();
  const repoId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns rows mapped into day/count points', async () => {
    (db.$queryRaw as any).mockResolvedValue([{ day: '2026-01-19', count: '3' }]);

    const points = await taskService.getTaskVolumeByDay({
      repoId,
      start: new Date('2026-01-01T00:00:00.000Z'),
      endExclusive: new Date('2026-01-03T00:00:00.000Z')
    });

    expect(points).toEqual([{ day: '2026-01-19', count: 3 }]);

    const [sqlParts] = (db.$queryRaw as any).mock.calls?.[0] ?? [];
    const sql = Array.isArray(sqlParts) ? sqlParts.join('') : String(sqlParts ?? '');
    expect(sql).toContain("created_at AT TIME ZONE 'UTC'");
    expect(sql).toContain('GROUP BY 1');
  });

  test('rejects invalid UUIDs without querying the database', async () => {
    const points = await taskService.getTaskVolumeByDay({
      repoId: 'not-a-uuid',
      start: new Date('2026-01-01T00:00:00.000Z'),
      endExclusive: new Date('2026-01-03T00:00:00.000Z')
    });

    expect(points).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});


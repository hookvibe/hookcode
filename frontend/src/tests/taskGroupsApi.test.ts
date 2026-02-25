import { beforeEach, describe, expect, test, vi } from 'vitest';
import { startTaskGroupPreview, stopTaskGroupPreview } from '../api/taskGroups';
import { api, invalidateTaskCaches } from '../api/client';

vi.mock('../api/client', () => ({
  __esModule: true,
  api: { post: vi.fn() },
  getCached: vi.fn(),
  invalidateTaskCaches: vi.fn()
}));

describe('taskGroups API cache invalidation', () => {
  beforeEach(() => {
    (api.post as unknown as ReturnType<typeof vi.fn>).mockReset();
    (invalidateTaskCaches as unknown as ReturnType<typeof vi.fn>).mockReset();
  });

  test('startTaskGroupPreview invalidates task caches', async () => {
    // Ensure preview start refreshes sidebar caches for indicator dots. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true, instances: [] }
    });

    await startTaskGroupPreview('group-1');

    expect(invalidateTaskCaches).toHaveBeenCalled();
  });

  test('stopTaskGroupPreview invalidates task caches', async () => {
    // Ensure preview stop refreshes sidebar caches for indicator dots. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    (api.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { success: true }
    });

    await stopTaskGroupPreview('group-1');

    expect(invalidateTaskCaches).toHaveBeenCalled();
  });
});

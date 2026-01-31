import { describe, expect, test, vi } from 'vitest';

describe('api cache', () => {
  test('listRepos caches repeated calls within the TTL window', async () => {
    vi.resetModules();
    const apiModule = await import('../api');
    const getSpy = vi.spyOn(apiModule.api, 'get').mockResolvedValue({ data: { repos: [] } });

    await apiModule.listRepos();
    await apiModule.listRepos();

    // Expect repo list calls to be deduped via GET cache. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    expect(getSpy).toHaveBeenCalledTimes(1);
    getSpy.mockRestore();
  });
});

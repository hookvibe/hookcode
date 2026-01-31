import { TtlCache } from '../../utils/ttlCache';

describe('utils/ttlCache', () => {
  test('caches values within TTL and refreshes after expiry', async () => {
    // Verify TTL caching behavior for provider metadata/activity requests. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    jest.useFakeTimers().setSystemTime(new Date('2026-01-28T00:00:00.000Z'));
    const cache = new TtlCache<string, number>(10);
    let calls = 0;

    const first = await cache.getOrSet('k', 1000, async () => {
      calls += 1;
      return 5;
    });
    const second = await cache.getOrSet('k', 1000, async () => {
      calls += 1;
      return 6;
    });

    expect(first).toBe(5);
    expect(second).toBe(5);
    expect(calls).toBe(1);

    jest.setSystemTime(new Date('2026-01-28T00:00:02.000Z'));
    const third = await cache.getOrSet('k', 1000, async () => {
      calls += 1;
      return 7;
    });

    expect(third).toBe(7);
    expect(calls).toBe(2);
    jest.useRealTimers();
  });

  test('deduplicates in-flight factory calls', async () => {
    // Ensure concurrent calls share a single factory invocation. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    const cache = new TtlCache<string, number>(10);
    let calls = 0;
    let resolve: (value: number) => void = () => {};
    const promise = new Promise<number>((res) => {
      resolve = res;
    });

    const factory = async () => {
      calls += 1;
      return promise;
    };

    const pendingA = cache.getOrSet('k', 1000, factory);
    const pendingB = cache.getOrSet('k', 1000, factory);

    resolve(42);
    const [resultA, resultB] = await Promise.all([pendingA, pendingB]);

    expect(resultA).toBe(42);
    expect(resultB).toBe(42);
    expect(calls).toBe(1);
  });
});

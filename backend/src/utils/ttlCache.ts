// Provide a tiny in-memory TTL cache with in-flight de-duplication for dashboard reads. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
export type CacheFactory<V> = () => Promise<V> | V;

type CacheEntry<V> = {
  value: V;
  expiresAt: number;
};

export class TtlCache<K, V> {
  private readonly store = new Map<K, CacheEntry<V>>();
  private readonly inflight = new Map<K, Promise<V>>();

  constructor(private readonly maxEntries = 500) {}

  get(key: K, now = Date.now()): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: K, value: V, ttlMs: number, now = Date.now()): void {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;
    this.store.set(key, { value, expiresAt: now + ttlMs });
    this.prune(now);
  }

  async getOrSet(key: K, ttlMs: number, factory: CacheFactory<V>): Promise<V> {
    const now = Date.now();
    const cached = this.get(key, now);
    if (cached !== undefined) return cached;
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return await factory();
    const inflight = this.inflight.get(key);
    if (inflight) return inflight;

    const task = Promise.resolve()
      .then(factory)
      .then((value) => {
        this.set(key, value, ttlMs, now);
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, task);
    return task;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) this.store.delete(key);
    }
    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value as K | undefined;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
  }
}

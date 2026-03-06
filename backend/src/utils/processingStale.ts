const parsePositiveMs = (value: string | undefined): number | null => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

export const resolveProcessingStaleMs = (rawValue: string | undefined = process.env.PROCESSING_STALE_MS): number | null => {
  // Keep processing-timeout recovery opt-in so long-running tasks are unlimited unless explicitly configured. docs/en/developer/plans/worker-stuck-reasoning-20260304/task_plan.md worker-stuck-reasoning-20260304
  return parsePositiveMs(rawValue);
};

export const resolveProcessingStaleBefore = (
  staleMs: number | null,
  nowMs: number = Date.now()
): Date | null => {
  if (typeof staleMs !== 'number' || !Number.isFinite(staleMs) || staleMs <= 0) return null;
  return new Date(nowMs - staleMs);
};

export const isProcessingStale = (params: {
  updatedAtMs: number;
  nowMs?: number;
  staleMs: number | null;
}): boolean => {
  const nowMs = typeof params.nowMs === 'number' ? params.nowMs : Date.now();
  if (!Number.isFinite(params.updatedAtMs)) return false;
  if (typeof params.staleMs !== 'number' || !Number.isFinite(params.staleMs) || params.staleMs <= 0) return false;
  return nowMs - params.updatedAtMs > params.staleMs;
};

export const formatProcessingStaleMs = (staleMs: number | null): string => {
  return typeof staleMs === 'number' && Number.isFinite(staleMs) && staleMs > 0 ? `${staleMs}ms` : 'disabled';
};

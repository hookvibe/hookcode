import {
  formatProcessingStaleMs,
  isProcessingStale,
  resolveProcessingStaleBefore,
  resolveProcessingStaleMs
} from '../../utils/processingStale';

describe('processingStale utils', () => {
  // Verify stale-timeout parsing defaults to disabled mode when env is unset or invalid. docs/en/developer/plans/worker-stuck-reasoning-20260304/task_plan.md worker-stuck-reasoning-20260304
  test('resolveProcessingStaleMs treats empty/invalid/non-positive values as disabled', () => {
    expect(resolveProcessingStaleMs(undefined)).toBeNull();
    expect(resolveProcessingStaleMs('')).toBeNull();
    expect(resolveProcessingStaleMs('abc')).toBeNull();
    expect(resolveProcessingStaleMs('0')).toBeNull();
    expect(resolveProcessingStaleMs('-1')).toBeNull();
  });

  test('resolveProcessingStaleMs returns floored positive milliseconds', () => {
    expect(resolveProcessingStaleMs('60000')).toBe(60000);
    expect(resolveProcessingStaleMs('60000.9')).toBe(60000);
  });

  test('resolveProcessingStaleBefore returns null when stale timeout is disabled', () => {
    expect(resolveProcessingStaleBefore(null, 1_000_000)).toBeNull();
  });

  test('isProcessingStale honors configured threshold and disabled mode', () => {
    expect(isProcessingStale({ updatedAtMs: 1_000, nowMs: 10_000, staleMs: null })).toBe(false);
    expect(isProcessingStale({ updatedAtMs: 1_000, nowMs: 10_000, staleMs: 9_000 })).toBe(false);
    expect(isProcessingStale({ updatedAtMs: 1_000, nowMs: 10_001, staleMs: 9_000 })).toBe(true);
  });

  test('formatProcessingStaleMs renders disabled label when timeout is absent', () => {
    expect(formatProcessingStaleMs(null)).toBe('disabled');
    expect(formatProcessingStaleMs(1800000)).toBe('1800000ms');
  });
});

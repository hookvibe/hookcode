import { parseOptionalDurationMs } from '../../utils/env';

// Cover PROCESSING_STALE_MS parsing semantics for disabled timeouts. docs/en/developer/plans/stale-disable-20260305/task_plan.md stale-disable-20260305

describe('parseOptionalDurationMs', () => {
  test('returns fallback when value is undefined', () => {
    expect(parseOptionalDurationMs(undefined, 1000)).toBe(1000);
  });

  test('returns null when value is blank', () => {
    expect(parseOptionalDurationMs('', 1000)).toBeNull();
    expect(parseOptionalDurationMs('   ', 1000)).toBeNull();
  });

  test('returns null when value is zero', () => {
    expect(parseOptionalDurationMs('0', 1000)).toBeNull();
  });

  test('returns fallback when value is invalid or negative', () => {
    expect(parseOptionalDurationMs('not-a-number', 1000)).toBe(1000);
    expect(parseOptionalDurationMs('-5', 1000)).toBe(1000);
  });

  test('returns parsed number when value is positive', () => {
    expect(parseOptionalDurationMs('5000', 1000)).toBe(5000);
  });
});

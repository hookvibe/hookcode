import { isTimeWindowActive, normalizeTimeWindow } from '../../utils/timeWindow';

// Validate time-window normalization and evaluation logic for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
describe('timeWindow utils', () => {
  test('normalizeTimeWindow returns null for invalid inputs', () => {
    expect(normalizeTimeWindow(null)).toBeNull();
    expect(normalizeTimeWindow({ startHour: -1, endHour: 2 })).toBeNull();
    expect(normalizeTimeWindow({ startHour: 2, endHour: 24 })).toBeNull();
  });

  test('normalizeTimeWindow accepts valid hour bounds', () => {
    expect(normalizeTimeWindow({ startHour: 2, endHour: 4 })).toEqual({ startHour: 2, endHour: 4 });
  });

  test('isTimeWindowActive handles normal ranges and wrap-around', () => {
    const normal = { startHour: 2, endHour: 4 };
    expect(isTimeWindowActive(normal, new Date(2026, 0, 1, 2, 0, 0))).toBe(true);
    expect(isTimeWindowActive(normal, new Date(2026, 0, 1, 5, 0, 0))).toBe(false);

    const wrap = { startHour: 22, endHour: 2 };
    expect(isTimeWindowActive(wrap, new Date(2026, 0, 1, 23, 0, 0))).toBe(true);
    expect(isTimeWindowActive(wrap, new Date(2026, 0, 2, 1, 0, 0))).toBe(true);
    expect(isTimeWindowActive(wrap, new Date(2026, 0, 2, 12, 0, 0))).toBe(false);
  });

  test('isTimeWindowActive treats start==end as always allowed', () => {
    const full = { startHour: 3, endHour: 3 };
    expect(isTimeWindowActive(full, new Date(2026, 0, 1, 0, 0, 0))).toBe(true);
    expect(isTimeWindowActive(full, new Date(2026, 0, 1, 12, 0, 0))).toBe(true);
  });
});

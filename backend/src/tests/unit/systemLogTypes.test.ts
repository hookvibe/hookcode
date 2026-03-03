import {
  coerceSystemLogCategory,
  coerceSystemLogLevel,
  normalizeSystemLogCategory,
  normalizeSystemLogLevel
} from '../../types/systemLog';

// Verify system log type normalization and coercion behavior. docs/en/developer/plans/systemlog-typefix-20260302/task_plan.md systemlog-typefix-20260302
describe('types/systemLog', () => {
  test('normalizeSystemLogCategory returns typed values for valid inputs', () => {
    expect(normalizeSystemLogCategory('system')).toBe('system');
    expect(normalizeSystemLogCategory('  operation ')).toBe('operation');
    expect(normalizeSystemLogCategory('execution')).toBe('execution');
  });

  test('normalizeSystemLogCategory returns undefined for invalid inputs', () => {
    expect(normalizeSystemLogCategory('')).toBeUndefined();
    expect(normalizeSystemLogCategory('unknown')).toBeUndefined();
    expect(normalizeSystemLogCategory(123)).toBeUndefined();
  });

  test('normalizeSystemLogLevel returns typed values for valid inputs', () => {
    expect(normalizeSystemLogLevel('info')).toBe('info');
    expect(normalizeSystemLogLevel('  warn ')).toBe('warn');
    expect(normalizeSystemLogLevel('error')).toBe('error');
  });

  test('normalizeSystemLogLevel returns undefined for invalid inputs', () => {
    expect(normalizeSystemLogLevel('')).toBeUndefined();
    expect(normalizeSystemLogLevel('fatal')).toBeUndefined();
    expect(normalizeSystemLogLevel(null)).toBeUndefined();
  });

  test('coerce helpers fall back when inputs are invalid', () => {
    expect(coerceSystemLogCategory('invalid', 'system')).toBe('system');
    expect(coerceSystemLogLevel('invalid', 'info')).toBe('info');
  });
});

import { normalizeString, parseOptionalBoolean, parsePositiveInt } from '../../utils/parse';

describe('utils/parse', () => {
  test('parsePositiveInt: parses positive integers', () => {
    expect(parsePositiveInt('1', 999)).toBe(1);
    expect(parsePositiveInt('10', 999)).toBe(10);
    expect(parsePositiveInt('10.9', 999)).toBe(10);
  });

  test('parsePositiveInt: falls back for invalid values', () => {
    expect(parsePositiveInt(undefined, 5)).toBe(5);
    expect(parsePositiveInt(null, 5)).toBe(5);
    expect(parsePositiveInt('0', 5)).toBe(5);
    expect(parsePositiveInt('-1', 5)).toBe(5);
    expect(parsePositiveInt('abc', 5)).toBe(5);
  });

  test('normalizeString: trims strings and returns undefined for empty', () => {
    expect(normalizeString(undefined)).toBeUndefined();
    expect(normalizeString(null)).toBeUndefined();
    expect(normalizeString(123)).toBeUndefined();
    expect(normalizeString('')).toBeUndefined();
    expect(normalizeString('   ')).toBeUndefined();
    expect(normalizeString('  hello  ')).toBe('hello');
  });

  test('parseOptionalBoolean: parses truthy/falsey strings', () => {
    // Cover query toggles used by list endpoints. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
    expect(parseOptionalBoolean('true')).toBe(true);
    expect(parseOptionalBoolean('1')).toBe(true);
    expect(parseOptionalBoolean('yes')).toBe(true);
    expect(parseOptionalBoolean('on')).toBe(true);
    expect(parseOptionalBoolean('false')).toBe(false);
    expect(parseOptionalBoolean('0')).toBe(false);
    expect(parseOptionalBoolean('no')).toBe(false);
    expect(parseOptionalBoolean('off')).toBe(false);
    expect(parseOptionalBoolean('')).toBeUndefined();
    expect(parseOptionalBoolean('maybe')).toBeUndefined();
    expect(parseOptionalBoolean(undefined)).toBeUndefined();
  });
});

import { normalizeString, parsePositiveInt } from '../../utils/parse';

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
});


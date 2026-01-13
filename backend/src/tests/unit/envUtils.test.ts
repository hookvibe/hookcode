import { isTruthy } from '../../utils/env';

describe('utils/env', () => {
  test('isTruthy: respects default for nullish/empty', () => {
    expect(isTruthy(undefined, true)).toBe(true);
    expect(isTruthy(undefined, false)).toBe(false);
    expect(isTruthy(null, true)).toBe(true);
    expect(isTruthy('', true)).toBe(true);
    expect(isTruthy('   ', false)).toBe(false);
  });

  test('isTruthy: parses common boolean tokens', () => {
    expect(isTruthy('1', false)).toBe(true);
    expect(isTruthy('true', false)).toBe(true);
    expect(isTruthy(' yes ', false)).toBe(true);
    expect(isTruthy('Y', false)).toBe(true);
    expect(isTruthy('on', false)).toBe(true);

    expect(isTruthy('0', true)).toBe(false);
    expect(isTruthy('false', true)).toBe(false);
    expect(isTruthy(' no ', true)).toBe(false);
    expect(isTruthy('N', true)).toBe(false);
    expect(isTruthy('off', true)).toBe(false);
  });

  test('isTruthy: falls back for unknown values', () => {
    expect(isTruthy('maybe', true)).toBe(true);
    expect(isTruthy('maybe', false)).toBe(false);
    expect(isTruthy({}, true)).toBe(true);
    expect(isTruthy({}, false)).toBe(false);
  });

  test('isTruthy: supports non-string primitives', () => {
    expect(isTruthy(true, false)).toBe(true);
    expect(isTruthy(false, true)).toBe(false);
    expect(isTruthy(1, false)).toBe(true);
    expect(isTruthy(0, true)).toBe(false);
  });
});


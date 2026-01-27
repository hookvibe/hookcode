import { describe, expect, test } from 'vitest';
import { isLocalhostUrl } from '../utils/url';

// Guard webhook onboarding UX by detecting localhost URLs in a shared helper. 58w1q3n5nr58flmempxe

describe('isLocalhostUrl', () => {
  test('returns true for localhost hosts', () => {
    expect(isLocalhostUrl('http://localhost:3000/api/webhook')).toBe(true);
    expect(isLocalhostUrl('https://127.0.0.1/api/webhook')).toBe(true);
    expect(isLocalhostUrl('http://0.0.0.0:4000/api/webhook')).toBe(true);
    expect(isLocalhostUrl('http://[::1]/api/webhook')).toBe(true);
  });

  test('returns false for non-localhost hosts', () => {
    expect(isLocalhostUrl('https://example.com/api/webhook')).toBe(false);
  });

  test('returns false for invalid URLs', () => {
    expect(isLocalhostUrl('not a url')).toBe(false);
  });
});


import type { Request } from 'express';
import { extractAuthToken } from '../../modules/auth/authToken';

// Validate auth token extraction including preview cookies. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
describe('extractAuthToken', () => {
  const buildReq = (headers: Record<string, string | undefined>, query?: Record<string, any>): Request =>
    ({
      header: (name: string) => headers[name.toLowerCase()],
      headers,
      query: query ?? {}
    } as unknown as Request);

  test('reads bearer token from authorization header', () => {
    const req = buildReq({ authorization: 'Bearer abc123' });
    expect(extractAuthToken(req)).toBe('abc123');
  });

  test('reads preview token from cookies', () => {
    const req = buildReq({ cookie: 'hookcode-preview-token=preview123; other=value' });
    expect(extractAuthToken(req)).toBe('preview123');
  });

  test('reads token from query when allowed', () => {
    const req = buildReq({}, { token: 'query123' });
    expect(extractAuthToken(req, { allowQueryToken: true })).toBe('query123');
  });
});

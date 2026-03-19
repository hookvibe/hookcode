import { normalizeWorkerApiBaseUrl, resolveWorkerPublicApiBaseUrl } from '../../modules/workers/worker-public-url';

describe('worker public api url', () => {
  test('normalizes configured urls to the api base path', () => {
    expect(normalizeWorkerApiBaseUrl('http://example.com:7213')).toBe('http://example.com:7213/api');
    expect(normalizeWorkerApiBaseUrl('https://example.com/base/')).toBe('https://example.com/base/api');
    expect(normalizeWorkerApiBaseUrl('https://example.com/api')).toBe('https://example.com/api');
  });

  test('prefers explicit worker public api env over request host inference', () => {
    const resolved = resolveWorkerPublicApiBaseUrl(
      {
        get: (header: string) => (header === 'host' ? 'console.example.com' : undefined),
        protocol: 'https'
      } as any,
      {
        HOOKCODE_WORKER_PUBLIC_API_BASE_URL: 'http://backend.example.com:7213/api'
      } as NodeJS.ProcessEnv
    );

    expect(resolved).toEqual({
      backendUrl: 'http://backend.example.com:7213/api',
      wsUrl: 'ws://backend.example.com:7213/api/workers/connect',
      source: 'env'
    });
  });

  test('uses forwarded host and forwarded port when a proxy strips the original port from host', () => {
    const resolved = resolveWorkerPublicApiBaseUrl(
      {
        get: (header: string) => {
          if (header === 'host') return 'yuhe.space';
          if (header === 'x-forwarded-host') return 'yuhe.space';
          if (header === 'x-forwarded-proto') return 'https';
          if (header === 'x-forwarded-port') return '7213';
          return undefined;
        },
        protocol: 'http'
      } as any,
      {} as NodeJS.ProcessEnv
    );

    expect(resolved).toEqual({
      backendUrl: 'https://yuhe.space:7213/api',
      wsUrl: 'wss://yuhe.space:7213/api/workers/connect',
      source: 'request'
    });
  });
});

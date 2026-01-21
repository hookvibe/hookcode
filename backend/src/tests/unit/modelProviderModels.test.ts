import { CODEX_PROVIDER_KEY } from '../../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY } from '../../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY } from '../../modelProviders/geminiCli';
import { ModelProviderModelsFetchError, listModelProviderModels } from '../../services/modelProviderModels';

describe('model provider models', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('uses /models when baseUrl already includes version', async () => {
    // Validate URL joining rules so proxies with path prefixes keep working. b8fucnmey62u0muyn7i0
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [{ id: 'gpt-5.2' }] }),
      text: async () => ''
    })) as any;
    global.fetch = fetchMock;

    await listModelProviderModels({
      provider: CODEX_PROVIDER_KEY,
      apiKey: 'k',
      apiBaseUrl: 'https://proxy.example/openai/v1'
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://proxy.example/openai/v1/models');
    expect((fetchMock.mock.calls[0][1] as any)?.headers?.Authorization).toBe('Bearer k');
  });

  test('adds version prefix when baseUrl has no version segment', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [{ id: 'gpt-5.1-codex-max' }] }),
      text: async () => ''
    })) as any;
    global.fetch = fetchMock;

    await listModelProviderModels({
      provider: CODEX_PROVIDER_KEY,
      apiKey: 'k',
      apiBaseUrl: 'https://proxy.example/openai'
    });

    expect(String(fetchMock.mock.calls[0][0])).toBe('https://proxy.example/openai/v1/models');
  });

  test('returns fallback models when the endpoint is missing (404)', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
      text: async () => 'not found'
    })) as any;
    global.fetch = fetchMock;

    const result = await listModelProviderModels({
      provider: CLAUDE_CODE_PROVIDER_KEY,
      apiKey: 'k',
      apiBaseUrl: 'https://proxy.example/anthropic'
    });

    expect(result.source).toBe('fallback');
    expect(result.models.length).toBeGreaterThan(0);
  });

  test('throws when apiKey is invalid (401/403)', async () => {
    const fetchMock = jest.fn(async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({}),
      text: async () => 'unauthorized'
    })) as any;
    global.fetch = fetchMock;

    await expect(
      listModelProviderModels({
        provider: GEMINI_CLI_PROVIDER_KEY,
        apiKey: 'k',
        apiBaseUrl: 'https://proxy.example/gemini'
      })
    ).rejects.toBeInstanceOf(ModelProviderModelsFetchError);
  });
});


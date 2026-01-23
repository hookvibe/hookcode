import crypto from 'crypto';
import { CODEX_PROVIDER_KEY } from '../modelProviders/codex';
import { CLAUDE_CODE_PROVIDER_KEY } from '../modelProviders/claudeCode';
import { GEMINI_CLI_PROVIDER_KEY } from '../modelProviders/geminiCli';

export type SupportedModelProviderKey = typeof CODEX_PROVIDER_KEY | typeof CLAUDE_CODE_PROVIDER_KEY | typeof GEMINI_CLI_PROVIDER_KEY;
export type ModelProviderModelsSource = 'remote' | 'fallback';

export interface ModelProviderModelsResult {
  models: string[];
  source: ModelProviderModelsSource;
}

export class ModelProviderModelsFetchError extends Error {
  status: number;
  statusText: string;
  bodyText: string;
  url: string;

  constructor(params: { status: number; statusText: string; bodyText: string; url: string }) {
    super(`Model provider models request failed: ${params.status} ${params.statusText}`);
    this.status = params.status;
    this.statusText = params.statusText;
    this.bodyText = params.bodyText;
    this.url = params.url;
  }
}

const DEFAULT_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const FALLBACK_MODELS: Record<SupportedModelProviderKey, string[]> = {
  codex: ['gpt-5.2', 'gpt-5.1-codex-max', 'gpt-5.1-codex-mini'],
  claude_code: ['claude-sonnet-4-5-20250929', 'claude-opus-4-20250929'],
  gemini_cli: ['gemini-2.5-pro', 'gemini-2.5-flash']
};

const DEFAULT_BASE_URL: Record<SupportedModelProviderKey, string> = {
  codex: 'https://api.openai.com/v1',
  claude_code: 'https://api.anthropic.com',
  gemini_cli: 'https://generativelanguage.googleapis.com/v1beta'
};

type CacheEntry = { expiresAt: number; result: ModelProviderModelsResult };

const cache = new Map<string, CacheEntry>();

const sha256Short = (value: string): string => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);

export const normalizeSupportedModelProviderKey = (value: unknown): SupportedModelProviderKey => {
  // Normalize provider keys for model discovery endpoints (reject unknown providers). b8fucnmey62u0muyn7i0
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw || raw === CODEX_PROVIDER_KEY) return CODEX_PROVIDER_KEY;
  if (raw === CLAUDE_CODE_PROVIDER_KEY) return CLAUDE_CODE_PROVIDER_KEY;
  if (raw === GEMINI_CLI_PROVIDER_KEY) return GEMINI_CLI_PROVIDER_KEY;
  throw new Error('provider must be codex, claude_code, or gemini_cli');
};

const joinUrl = (base: string, path: string): string => {
  const baseTrimmed = base.replace(/\/+$/, '');
  const pathTrimmed = path.replace(/^\/+/, '');
  return `${baseTrimmed}/${pathTrimmed}`;
};

const endsWithPath = (baseUrl: string, suffix: string): boolean => {
  try {
    const url = new URL(baseUrl);
    const pathname = url.pathname.replace(/\/+$/, '');
    return pathname.endsWith(`/${suffix}`) || pathname === suffix;
  } catch {
    return false;
  }
};

const normalizeModelIds = (models: string[]): string[] => {
  const deduped = Array.from(new Set(models.map((m) => String(m ?? '').trim()).filter(Boolean)));
  return deduped.sort((a, b) => a.localeCompare(b));
};

const parseOpenAiModels = (json: any): string[] => {
  const data = Array.isArray(json?.data) ? json.data : [];
  return normalizeModelIds(data.map((item: any) => String(item?.id ?? '').trim()).filter(Boolean));
};

const parseAnthropicModels = (json: any): string[] => {
  const data = Array.isArray(json?.data) ? json.data : [];
  return normalizeModelIds(data.map((item: any) => String(item?.id ?? '').trim()).filter(Boolean));
};

const parseGeminiModels = (json: any): string[] => {
  const data = Array.isArray(json?.models) ? json.models : [];
  const ids = data
    .map((item: any) => String(item?.name ?? '').trim())
    .filter(Boolean)
    .map((name: string) => {
      const parts = name.split('/').filter(Boolean);
      return parts.length ? parts[parts.length - 1] : name;
    });
  return normalizeModelIds(ids);
};

const requestJson = async (params: {
  url: string;
  headers: Record<string, string>;
  timeoutMs?: number;
}): Promise<any> => {
  const controller = new AbortController();
  const timeoutMs = typeof params.timeoutMs === 'number' && params.timeoutMs > 0 ? params.timeoutMs : DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(params.url, {
      method: 'GET',
      headers: params.headers,
      signal: controller.signal
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new ModelProviderModelsFetchError({
        status: res.status,
        statusText: res.statusText,
        bodyText,
        url: params.url
      });
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
};

const buildModelsUrl = (provider: SupportedModelProviderKey, apiBaseUrl?: string): string => {
  const base = (apiBaseUrl ?? '').trim() || DEFAULT_BASE_URL[provider];
  const normalized = base.replace(/\/+$/, '');

  if (provider === CODEX_PROVIDER_KEY) {
    return joinUrl(normalized, endsWithPath(normalized, 'v1') ? 'models' : 'v1/models');
  }
  if (provider === CLAUDE_CODE_PROVIDER_KEY) {
    return joinUrl(normalized, endsWithPath(normalized, 'v1') ? 'models' : 'v1/models');
  }
  return joinUrl(normalized, endsWithPath(normalized, 'v1beta') ? 'models' : 'v1beta/models');
};

export const listModelProviderModels = async (params: {
  provider: SupportedModelProviderKey;
  apiKey: string;
  apiBaseUrl?: string;
  forceRefresh?: boolean;
  timeoutMs?: number;
}): Promise<ModelProviderModelsResult> => {
  // Business intent: dynamically discover provider models for credentials so the UI doesn't hardcode model ids. b8fucnmey62u0muyn7i0
  const provider = params.provider;
  const apiKey = String(params.apiKey ?? '').trim();
  const apiBaseUrl = String(params.apiBaseUrl ?? '').trim();
  if (!apiKey) {
    return { models: FALLBACK_MODELS[provider], source: 'fallback' };
  }

  const cacheKey = `${provider}:${apiBaseUrl || DEFAULT_BASE_URL[provider]}:${sha256Short(apiKey)}`;
  const now = Date.now();
  const cached = cache.get(cacheKey);
  if (!params.forceRefresh && cached && cached.expiresAt > now) return cached.result;
  if (cached && cached.expiresAt <= now) cache.delete(cacheKey);

  const url = buildModelsUrl(provider, apiBaseUrl || undefined);
  const timeoutMs = params.timeoutMs;

  const remote = await (async (): Promise<ModelProviderModelsResult> => {
    try {
      if (provider === CODEX_PROVIDER_KEY) {
        const json = await requestJson({
          url,
          timeoutMs,
          headers: {
            Authorization: `Bearer ${apiKey}`
          }
        });
        return { models: parseOpenAiModels(json), source: 'remote' };
      }

      if (provider === CLAUDE_CODE_PROVIDER_KEY) {
        const json = await requestJson({
          url,
          timeoutMs,
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          }
        });
        return { models: parseAnthropicModels(json), source: 'remote' };
      }

      const json = await requestJson({
        url,
        timeoutMs,
        headers: {
          'x-goog-api-key': apiKey
        }
      });
      return { models: parseGeminiModels(json), source: 'remote' };
    } catch (err) {
      // Safety: treat "endpoint not found" as "model list is not supported by this API base URL" and fall back. b8fucnmey62u0muyn7i0
      if (err instanceof ModelProviderModelsFetchError && (err.status === 404 || err.status === 405)) {
        return { models: FALLBACK_MODELS[provider], source: 'fallback' };
      }
      throw err;
    }
  })();

  // Treat "empty list" as a degraded capability and fall back to curated defaults. b8fucnmey62u0muyn7i0
  const normalized = normalizeModelIds(remote.models);
  const result: ModelProviderModelsResult = normalized.length ? { ...remote, models: normalized } : { models: FALLBACK_MODELS[provider], source: 'fallback' };

  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, result });
  return result;
};

export const getFallbackModels = (provider: SupportedModelProviderKey): string[] => FALLBACK_MODELS[provider];

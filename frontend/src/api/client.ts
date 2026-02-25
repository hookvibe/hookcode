import axios from 'axios';
import { clearAuth, getToken, saveLoginNext } from '../auth';

// Split API client setup and cache helpers into a focused module for maintainability. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

// Export the API base URL so iframe previews can reuse the same origin. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const API_BASE_URL = apiBaseUrl;

export const api = axios.create({
  baseURL: apiBaseUrl
});

type GetCacheEntry<T> = { value: T; expiresAt: number };

const GET_CACHE_MAX_ENTRIES = 400;
const getCache = new Map<string, GetCacheEntry<any>>();
const getInflight = new Map<string, Promise<any>>();

const stableStringify = (value: any): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
};

const buildGetCacheKey = (url: string, params?: Record<string, any>): string => {
  // Build stable GET cache keys for in-flight de-dup and short TTL caching across pages. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  if (!params || Object.keys(params).length === 0) return url;
  return `${url}?${stableStringify(params)}`;
};

const pruneGetCache = (now: number) => {
  for (const [key, entry] of getCache.entries()) {
    if (entry.expiresAt <= now) getCache.delete(key);
  }
  while (getCache.size > GET_CACHE_MAX_ENTRIES) {
    const oldestKey = getCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    getCache.delete(oldestKey);
  }
};

export const invalidateGetCache = (prefix: string) => {
  // Clear cached GET responses after mutations to avoid stale lists. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  for (const key of Array.from(getCache.keys())) {
    if (key.startsWith(prefix)) getCache.delete(key);
  }
  for (const key of Array.from(getInflight.keys())) {
    if (key.startsWith(prefix)) getInflight.delete(key);
  }
};

export const getCached = async <T>(
  url: string,
  options?: { params?: Record<string, any>; cacheTtlMs?: number; dedupe?: boolean }
): Promise<T> => {
  const params = options?.params;
  const cacheKey = buildGetCacheKey(url, params);
  const now = Date.now();
  const ttl = options?.cacheTtlMs ?? 0;

  if (ttl > 0) {
    const cached = getCache.get(cacheKey);
    if (cached && cached.expiresAt > now) return cached.value as T;
  }

  const allowDedupe = options?.dedupe !== false;
  if (allowDedupe) {
    const inflight = getInflight.get(cacheKey);
    if (inflight) return inflight as Promise<T>;
  }

  const request = api
    .get<T>(url, { params })
    .then((res) => {
      if (ttl > 0) {
        getCache.set(cacheKey, { value: res.data, expiresAt: now + ttl });
        pruneGetCache(now);
      }
      return res.data;
    })
    .finally(() => {
      getInflight.delete(cacheKey);
    });

  if (allowDedupe) getInflight.set(cacheKey, request);
  return request;
};

export const invalidateRepoCaches = () => {
  // Keep repo lists and summaries fresh after repo/robot/automation mutations. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateGetCache('/repos');
};

export const invalidateTaskCaches = () => {
  // Clear task-related list caches after task mutations or chat execution. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  invalidateGetCache('/tasks');
  invalidateGetCache('/tasks/stats');
  invalidateGetCache('/tasks/volume');
  invalidateGetCache('/dashboard/sidebar');
  invalidateGetCache('/task-groups');
};

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 && typeof window !== 'undefined') {
      const requestUrl = String(error?.config?.url || '').split('?')[0];
      const skipRedirect = requestUrl.endsWith('/auth/login');
      if (!skipRedirect) {
        saveLoginNext(window.location.hash);
        clearAuth();
        if (!window.location.hash.startsWith('#/login')) {
          window.location.hash = '#/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

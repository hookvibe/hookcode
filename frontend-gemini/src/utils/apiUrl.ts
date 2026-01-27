import { getEnvValue } from './env';

/**
 * API URL helpers:
 * - Business context: Frontend / API clients (axios + SSE/EventSource).
 * - Purpose: build absolute URLs from `VITE_API_BASE_URL` while keeping tests portable across origins/ports. kxthpiu4eqrmu0c6bboa
 */
export const buildApiUrl = (path: string): string => {
  const rawApiBase = getEnvValue('VITE_API_BASE_URL') || '/api';
  const apiBase = typeof rawApiBase === 'string' && rawApiBase.trim() ? rawApiBase.trim() : '/api';

  const base = apiBase.startsWith('http') ? apiBase : new URL(apiBase, window.location.origin).toString();
  return new URL(String(path ?? '').replace(/^\//, ''), base.replace(/\/?$/, '/')).toString();
};


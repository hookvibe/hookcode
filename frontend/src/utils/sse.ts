import { getToken } from '../auth';
import { buildApiUrl } from './apiUrl';

/**
 * SSE helper:
 * - Business context: Frontend / Realtime updates.
 * - Purpose: create an authenticated EventSource URL (via `?token=`) since headers are not supported. kxthpiu4eqrmu0c6bboa
 */
export const createAuthedEventSource = (path: string, params?: Record<string, string>): EventSource => {
  const url = new URL(buildApiUrl(path));
  for (const [key, value] of Object.entries(params ?? {})) {
    if (!key) continue;
    url.searchParams.set(key, String(value));
  }
  const token = getToken();
  if (token) url.searchParams.set('token', token);
  return new EventSource(url.toString());
};


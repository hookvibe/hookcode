import type { Request } from 'express';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const DEFAULT_BACKEND_API_URL = 'http://127.0.0.1:3000/api';

const firstHeaderValue = (value: unknown): string => trimString(String(value ?? '').split(',')[0] ?? '');

const normalizeWorkerApiBaseUrl = (value: unknown): string => {
  const raw = trimString(value).replace(/\/+$/, '');
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, '');
    url.pathname = pathname.endsWith('/api') ? pathname || '/api' : `${pathname || ''}/api`;
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const buildWorkerWsUrl = (backendUrl: string): string =>
  backendUrl.replace(/^https?:/i, (protocol) => (protocol.toLowerCase() === 'https:' ? 'wss:' : 'ws:')) + '/workers/connect';

const hasExplicitPort = (host: string): boolean => {
  const trimmed = trimString(host);
  if (!trimmed) return false;
  if (/^\[[^\]]+\]:\d+$/.test(trimmed)) return true;
  const lastColon = trimmed.lastIndexOf(':');
  if (lastColon <= -1) return false;
  if (trimmed.includes(']')) return false;
  return /^\d+$/.test(trimmed.slice(lastColon + 1));
};

const isDefaultPort = (protocol: string, port: string): boolean => {
  const normalizedProtocol = trimString(protocol).toLowerCase();
  return (normalizedProtocol === 'https' && port === '443') || (normalizedProtocol !== 'https' && port === '80');
};

const appendPortToHost = (host: string, port: string): string => {
  if (!host || !port || hasExplicitPort(host)) return host;
  if (host.includes(':') && !host.startsWith('[')) return `[${host}]:${port}`;
  return `${host}:${port}`;
};

export const resolveWorkerPublicApiBaseUrl = (
  req: Pick<Request, 'get' | 'protocol'>,
  env: NodeJS.ProcessEnv = process.env
): { backendUrl: string; wsUrl: string; source: 'env' | 'request' } => {
  const configuredUrl = normalizeWorkerApiBaseUrl(env.HOOKCODE_WORKER_PUBLIC_API_BASE_URL);
  if (configuredUrl) {
    return {
      backendUrl: configuredUrl,
      wsUrl: buildWorkerWsUrl(configuredUrl),
      source: 'env'
    };
  }

  const forwardedProto = firstHeaderValue(req.get('x-forwarded-proto'));
  const protocol = forwardedProto || trimString(req.protocol) || 'http';
  const forwardedHost = firstHeaderValue(req.get('x-forwarded-host'));
  const host = forwardedHost || trimString(req.get('host')) || '127.0.0.1:3000';
  const forwardedPort = firstHeaderValue(req.get('x-forwarded-port'));
  const normalizedHost = forwardedPort && !isDefaultPort(protocol, forwardedPort) ? appendPortToHost(host, forwardedPort) : host;
  const fallbackUrl = normalizeWorkerApiBaseUrl(`${protocol}://${normalizedHost}`);
  const backendUrl = fallbackUrl || DEFAULT_BACKEND_API_URL;

  return {
    backendUrl,
    wsUrl: buildWorkerWsUrl(backendUrl),
    source: 'request'
  };
};

export { normalizeWorkerApiBaseUrl };

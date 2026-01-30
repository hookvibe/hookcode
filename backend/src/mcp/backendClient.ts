import type { McpServerConfig } from './config';

export type BackendHttpMethod = 'GET' | 'POST' | 'DELETE';

export interface BackendRequest {
  method: BackendHttpMethod;
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface BackendResponse {
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string | null;
}

const normalizePath = (path: string): string => {
  const trimmed = path.trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const toQueryValue = (value: string | number | boolean): string => {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
};

const buildUrl = (baseUrl: string, path: string, query?: BackendRequest['query']): string => {
  const base = baseUrl.replace(/\/+$/, '');
  const fullPath = normalizePath(path).replace(/^\/+/, '');
  const url = new URL(`${base}/${fullPath}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, toQueryValue(value));
    }
  }

  return url.toString();
};

const resolveAuthHeaderValue = (config: McpServerConfig, token: string): [string, string] => {
  if (config.authHeader === 'x-hookcode-token') {
    return ['x-hookcode-token', token];
  }
  return ['authorization', `Bearer ${token}`];
};

// Proxy MCP tool calls to the backend API with consistent auth handling. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
export const requestBackend = async (
  config: McpServerConfig,
  request: BackendRequest,
  token?: string
): Promise<BackendResponse> => {
  if (config.authRequired && !token) {
    throw new Error('Missing MCP auth token.');
  }

  const url = buildUrl(config.baseUrl, request.path, request.query);
  const headers = new Headers();

  if (request.headers) {
    for (const [key, value] of Object.entries(request.headers)) {
      if (!value) continue;
      headers.set(key, value);
    }
  }

  if (request.body !== undefined) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
  }

  if (token) {
    const [headerName, headerValue] = resolveAuthHeaderValue(config, token);
    headers.set(headerName, headerValue);
  }

  const response = await fetch(url, {
    method: request.method,
    headers,
    body: request.body === undefined ? undefined : JSON.stringify(request.body)
  });

  const rawText = await response.text();
  const contentType = response.headers.get('content-type') || '';
  let data: unknown = rawText;

  if (rawText && contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = rawText;
    }
  } else if (!rawText) {
    data = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
    rawText: rawText || null
  };
};

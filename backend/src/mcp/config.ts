import { isTruthy } from '../utils/env';

export type McpAuthHeader = 'authorization' | 'x-hookcode-token';

export interface McpServerConfig {
  host: string;
  port: number;
  baseUrl: string;
  authRequired: boolean;
  authHeader: McpAuthHeader;
  enableJsonResponse: boolean;
  allowedHosts?: string[];
}

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, '');

const parseAllowedHosts = (raw: string | undefined): string[] | undefined => {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  return value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
};

const resolveAuthHeader = (raw: string | undefined): McpAuthHeader => {
  const value = (raw ?? '').trim().toLowerCase();
  return value === 'x-hookcode-token' ? 'x-hookcode-token' : 'authorization';
};

const resolveBackendBaseUrl = (): string => {
  const explicit = (process.env.HOOKCODE_MCP_BACKEND_BASE_URL ?? '').trim();
  if (explicit) return normalizeBaseUrl(explicit);

  const fallback = (process.env.ADMIN_TOOLS_API_BASE_URL ?? '').trim();
  if (fallback) return normalizeBaseUrl(fallback);

  const host = (process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
  const port = Number(process.env.PORT) || 4000;
  return normalizeBaseUrl(`http://${host}:${port}/api`);
};

// Build MCP server configuration from env to proxy backend APIs. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
export const loadMcpServerConfig = (): McpServerConfig => {
  const host = (process.env.HOOKCODE_MCP_HOST || '127.0.0.1').trim() || '127.0.0.1';
  const port = Number(process.env.HOOKCODE_MCP_PORT ?? 7350);
  const authRequired = isTruthy(process.env.HOOKCODE_MCP_AUTH_REQUIRED, true);
  const enableJsonResponse = isTruthy(process.env.HOOKCODE_MCP_ENABLE_JSON_RESPONSE, false);
  const baseUrl = resolveBackendBaseUrl();
  const authHeader = resolveAuthHeader(process.env.HOOKCODE_MCP_AUTH_HEADER);
  const allowedHosts = parseAllowedHosts(process.env.HOOKCODE_MCP_ALLOWED_HOSTS);

  return {
    host,
    port,
    baseUrl,
    authRequired,
    authHeader,
    enableJsonResponse,
    allowedHosts
  };
};

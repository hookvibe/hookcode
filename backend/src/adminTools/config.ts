import { isTruthy } from '../utils/env';

const toPort = (value: unknown, fallback: number): number => {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
};

export interface AdminToolsConfig {
  enabled: boolean;
  host: string;
  prismaPort: number;
  swaggerPort: number;
  prismaUpstreamPort: number;
  apiBaseUrl: string;
  cookieSecure: boolean;
}

export const isAdminToolsEmbeddedEnabled = (): boolean => isTruthy(process.env.ADMIN_TOOLS_EMBEDDED, true);

export const loadAdminToolsConfig = (): AdminToolsConfig => {
  const enabled = isTruthy(process.env.ADMIN_TOOLS_ENABLED, false);
  const host = (process.env.ADMIN_TOOLS_HOST || '127.0.0.1').trim() || '127.0.0.1';
  const prismaPort = toPort(process.env.ADMIN_TOOLS_PRISMA_PORT, 7215);
  const swaggerPort = toPort(process.env.ADMIN_TOOLS_SWAGGER_PORT, 7216);
  const prismaUpstreamPort = toPort(process.env.ADMIN_TOOLS_PRISMA_UPSTREAM_PORT, 5555);
  const apiBaseUrl = (process.env.ADMIN_TOOLS_API_BASE_URL || 'http://localhost:4000/api').trim();
  const cookieSecure = isTruthy(process.env.ADMIN_TOOLS_COOKIE_SECURE, false);

  return {
    enabled,
    host,
    prismaPort,
    swaggerPort,
    prismaUpstreamPort,
    apiBaseUrl,
    cookieSecure
  };
};

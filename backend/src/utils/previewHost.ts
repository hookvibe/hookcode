import type { Request } from 'express';

export type PreviewHostMode = 'path' | 'subdomain';

const PREVIEW_HOST_DELIMITER = '--';

const normalizeDomain = (value: string): string =>
  value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^\*\./, '')
    .replace(/\/+$/, '');

const normalizeHost = (hostHeader?: string): string => {
  const raw = String(hostHeader ?? '').trim();
  if (!raw) return '';
  return raw.replace(/:\d+$/, '').toLowerCase();
};

export const getPreviewHostMode = (): PreviewHostMode => {
  // Allow preview host routing to switch between path-based and subdomain modes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const raw = String(process.env.HOOKCODE_PREVIEW_HOST_MODE ?? '').trim().toLowerCase();
  return raw === 'subdomain' ? 'subdomain' : 'path';
};

export const getPreviewBaseDomain = (): string | null => {
  // Normalize the preview base domain for wildcard subdomain routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const raw = String(process.env.HOOKCODE_PREVIEW_BASE_DOMAIN ?? '').trim();
  if (!raw) return null;
  const normalized = normalizeDomain(raw);
  return normalized ? normalized : null;
};

export const getPreviewPublicScheme = (): 'http' | 'https' => {
  // Allow custom scheme for preview public URLs (default https). docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const raw = String(process.env.HOOKCODE_PREVIEW_PUBLIC_SCHEME ?? '').trim().toLowerCase();
  return raw === 'http' ? 'http' : 'https';
};

export const buildPreviewSubdomainHost = (taskGroupId: string, instanceName: string, baseDomain: string): string => {
  // Build preview subdomain hostnames for public URLs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  return `${taskGroupId}${PREVIEW_HOST_DELIMITER}${instanceName}.${normalizeDomain(baseDomain)}`;
};

export const buildPreviewPublicUrl = (taskGroupId: string, instanceName: string): string | undefined => {
  // Derive public preview URLs when subdomain routing is enabled. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  if (getPreviewHostMode() !== 'subdomain') return undefined;
  const baseDomain = getPreviewBaseDomain();
  if (!baseDomain) return undefined;
  const host = buildPreviewSubdomainHost(taskGroupId, instanceName, baseDomain);
  return `${getPreviewPublicScheme()}://${host}/`;
};

export const resolvePreviewHostMatch = (
  hostHeader?: string
): { taskGroupId: string; instanceName: string } | null => {
  // Parse preview task-group routing from the request host for subdomain mode. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  if (getPreviewHostMode() !== 'subdomain') return null;
  const baseDomain = getPreviewBaseDomain();
  if (!baseDomain) return null;
  const host = normalizeHost(hostHeader);
  if (!host) return null;
  const normalizedBase = normalizeDomain(baseDomain).toLowerCase();
  if (!normalizedBase) return null;
  if (host === normalizedBase) return null;
  if (!host.endsWith(`.${normalizedBase}`)) return null;
  const prefix = host.slice(0, -(normalizedBase.length + 1));
  if (!prefix) return null;
  const delimiterIndex = prefix.lastIndexOf(PREVIEW_HOST_DELIMITER);
  if (delimiterIndex <= 0 || delimiterIndex >= prefix.length - PREVIEW_HOST_DELIMITER.length) return null;
  const taskGroupId = prefix.slice(0, delimiterIndex);
  const instanceName = prefix.slice(delimiterIndex + PREVIEW_HOST_DELIMITER.length);
  if (!taskGroupId || !instanceName) return null;
  return { taskGroupId, instanceName };
};

export const isRequestHttps = (req: Request): boolean => {
  // Respect forwarded proto headers for preview subdomain cookie security. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const forwarded = req.headers['x-forwarded-proto'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim().toLowerCase() === 'https';
  }
  return Boolean(req.secure);
};

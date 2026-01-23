import type { RepoProvider } from '../types/repository';

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const stripGitSuffix = (value: string): string => value.replace(/\.git$/i, '');

// Centralize git config keys used by agent hooks to avoid invalid names and keep tests aligned. docs/en/developer/plans/gitcfgfix20260123/task_plan.md gitcfgfix20260123
export const GIT_CONFIG_KEYS = {
  upstream: 'hookcode.upstream-url',
  push: 'hookcode.push-url'
};

export const normalizeGitRemoteUrl = (raw: string): string => {
  // Normalize git remote URLs so hook checks can compare repo identity without leaking credentials. 24yz61mdik7tqdgaa152
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  const withoutAuth = trimmed.replace(/(https?:\/\/)([^@/\s]+)@/i, '$1');
  const withoutGit = stripGitSuffix(withoutAuth);
  return stripTrailingSlash(withoutGit);
};

export const toRepoWebUrl = (raw: string): string => {
  // Convert git remote URLs (https or ssh) into a stable web URL for UI links. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const normalized = normalizeGitRemoteUrl(raw);
  if (!normalized) return '';
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;

  const scpMatch = /^git@([^:]+):(.+)$/.exec(normalized);
  if (scpMatch) {
    const host = scpMatch[1];
    const path = stripTrailingSlash(scpMatch[2]);
    return `https://${host}/${path}`;
  }

  const sshMatch = /^ssh:\/\/git@([^/]+)\/(.+)$/.exec(normalized);
  if (sshMatch) {
    const host = sshMatch[1];
    const path = stripTrailingSlash(sshMatch[2]);
    return `https://${host}/${path}`;
  }

  return normalized;
};

export const canTokenPushToUpstream = (provider: RepoProvider, roleRaw: unknown): boolean => {
  // Decide whether we can push to upstream based on the token's last-known repo role. 24yz61mdik7tqdgaa152
  const role = safeTrim(roleRaw).toLowerCase();
  if (!role) return false;
  if (provider === 'github') return role === 'admin' || role === 'maintain' || role === 'write';
  if (provider === 'gitlab') return role === 'owner' || role === 'maintainer' || role === 'developer';
  return false;
};

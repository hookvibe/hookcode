import type { RepoProvider } from '../types/repository';

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');
const stripGitSuffix = (value: string): string => value.replace(/\.git$/i, '');

export const normalizeGitRemoteUrl = (raw: string): string => {
  // Normalize git remote URLs so hook checks can compare repo identity without leaking credentials. 24yz61mdik7tqdgaa152
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return '';

  const withoutAuth = trimmed.replace(/(https?:\/\/)([^@/\s]+)@/i, '$1');
  const withoutGit = stripGitSuffix(withoutAuth);
  return stripTrailingSlash(withoutGit);
};

export const canTokenPushToUpstream = (provider: RepoProvider, roleRaw: unknown): boolean => {
  // Decide whether we can push to upstream based on the token's last-known repo role. 24yz61mdik7tqdgaa152
  const role = safeTrim(roleRaw).toLowerCase();
  if (!role) return false;
  if (provider === 'github') return role === 'admin' || role === 'maintain' || role === 'write';
  if (provider === 'gitlab') return role === 'owner' || role === 'maintainer' || role === 'developer';
  return false;
};


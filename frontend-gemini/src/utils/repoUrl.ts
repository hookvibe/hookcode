import type { RepoProvider } from '../api';

// Parse a user-provided repository URL/slug into backend-friendly fields (externalId + apiBaseUrl). 58w1q3n5nr58flmempxe

export type RepoUrlParseErrorCode = 'EMPTY' | 'INVALID_URL' | 'MISSING_OWNER_REPO' | 'PROVIDER_MISMATCH';

export interface ParsedRepoIdentity {
  name: string;
  externalId: string;
  apiBaseUrl: string | null;
}

const normalizePath = (value: string): string =>
  String(value ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.git$/, '');

const parseGitSsh = (raw: string): { host: string; path: string } | null => {
  const match = /^git@([^:]+):(.+)$/.exec(raw.trim());
  if (!match) return null;
  const host = String(match[1] ?? '').trim();
  const path = normalizePath(String(match[2] ?? ''));
  if (!host || !path) return null;
  return { host, path };
};

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

const isGithubDotCom = (host: string): boolean => host === 'github.com' || host === 'www.github.com';
const isGithubApi = (host: string): boolean => host === 'api.github.com';
const isGithubPublicHost = (host: string): boolean => isGithubDotCom(host) || isGithubApi(host);
const isGitlabDotCom = (host: string): boolean => host === 'gitlab.com' || host === 'www.gitlab.com';

const buildGithubApiBaseUrl = (host: string): string =>
  isGithubPublicHost(host) ? 'https://api.github.com' : `https://${host}/api/v3`;

// Guard against common GitHub/GitLab mixups and no-scheme inputs to prevent invalid repo records. 58w1q3n5nr58flmempxe
const isProviderMismatch = (provider: RepoProvider, host: string): boolean => {
  const normalized = String(host ?? '').trim().toLowerCase();
  if (!normalized) return false;
  if (provider === 'github') return isGitlabDotCom(normalized);
  return isGithubPublicHost(normalized);
};

const parseHostPathUrl = (raw: string): URL | null => {
  const input = String(raw ?? '').trim();
  if (!input) return null;
  if (parseUrl(input)) return null;
  const firstSegment = input.split('/')[0] ?? '';
  if (!firstSegment.includes('.') || !input.includes('/')) return null;
  return parseUrl(`https://${input}`);
};

export const parseRepoUrl = (provider: RepoProvider, rawInput: string): { ok: true; value: ParsedRepoIdentity } | { ok: false; code: RepoUrlParseErrorCode } => {
  const input = String(rawInput ?? '').trim();
  if (!input) return { ok: false, code: 'EMPTY' };

  const ssh = parseGitSsh(input);
  if (ssh) {
    if (isProviderMismatch(provider, ssh.host)) return { ok: false, code: 'PROVIDER_MISMATCH' };
    if (provider === 'github') {
      const parts = normalizePath(ssh.path).split('/').filter(Boolean);
      if (parts.length < 2) return { ok: false, code: 'MISSING_OWNER_REPO' };
      const externalId = `${parts[0]}/${parts[1]}`;
      return { ok: true, value: { name: externalId, externalId, apiBaseUrl: buildGithubApiBaseUrl(ssh.host) } };
    }

    const externalId = normalizePath(ssh.path);
    return { ok: true, value: { name: externalId, externalId, apiBaseUrl: `https://${ssh.host}` } };
  }

  const url = parseUrl(input) || parseHostPathUrl(input);
  if (url) {
    const host = url.hostname;
    if (isProviderMismatch(provider, host)) return { ok: false, code: 'PROVIDER_MISMATCH' };

    if (provider === 'github') {
      const parts = normalizePath(url.pathname).split('/').filter(Boolean);
      if (parts[0] === 'repositories' && parts[1]) {
        const externalId = String(parts[1] ?? '').trim();
        return { ok: true, value: { name: externalId, externalId, apiBaseUrl: buildGithubApiBaseUrl(host) } };
      }
      const normalizedParts = parts[0] === 'repos' ? parts.slice(1) : parts;
      if (normalizedParts.length < 2) return { ok: false, code: 'MISSING_OWNER_REPO' };
      const externalId = `${normalizedParts[0]}/${normalizedParts[1]}`;
      return { ok: true, value: { name: externalId, externalId, apiBaseUrl: buildGithubApiBaseUrl(host) } };
    }

    // GitLab web URLs may include `/-/` sections (issues, MR, files); keep only the project namespace path.
    const pathRaw = url.pathname.includes('/-/') ? url.pathname.split('/-/')[0] : url.pathname;
    const normalizedPath = normalizePath(pathRaw);
    if (!normalizedPath) return { ok: false, code: 'INVALID_URL' };

    const apiPrefix = 'api/v4/projects/';
    if (normalizedPath.startsWith(apiPrefix)) {
      const rest = normalizedPath.slice(apiPrefix.length);
      const first = rest.split('/')[0] ?? '';
      if (!first) return { ok: false, code: 'INVALID_URL' };
      try {
        const decoded = decodeURIComponent(first);
        const externalId = normalizePath(decoded);
        if (!externalId) return { ok: false, code: 'INVALID_URL' };
        return { ok: true, value: { name: externalId, externalId, apiBaseUrl: url.origin } };
      } catch {
        return { ok: false, code: 'INVALID_URL' };
      }
    }

    return { ok: true, value: { name: normalizedPath, externalId: normalizedPath, apiBaseUrl: url.origin } };
  }

  // Fallback: treat as a provider-native "slug".
  const slug = normalizePath(input);
  if (!slug) return { ok: false, code: 'INVALID_URL' };

  if (provider === 'github') {
    if (slug.startsWith('gitlab.com/') || slug.startsWith('www.gitlab.com/')) return { ok: false, code: 'PROVIDER_MISMATCH' };
    const parts = slug.split('/').filter(Boolean);
    if (parts.length < 2) return { ok: false, code: 'MISSING_OWNER_REPO' };
    const externalId = `${parts[0]}/${parts[1]}`;
    return { ok: true, value: { name: externalId, externalId, apiBaseUrl: null } };
  }

  if (slug.startsWith('github.com/') || slug.startsWith('www.github.com/') || slug.startsWith('api.github.com/')) {
    return { ok: false, code: 'PROVIDER_MISMATCH' };
  }
  return { ok: true, value: { name: slug, externalId: slug, apiBaseUrl: null } };
};

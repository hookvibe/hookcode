import type { RepoProvider, RepositoryBranch } from '../types/repository';

export interface RepoHydrationPatch {
  name?: string;
  externalId?: string;
  apiBaseUrl?: string;
  branches?: RepositoryBranch[];
}

export interface WebhookRepoIdentity {
  externalId: string | null;
  apiBaseUrl: string | null;
}

const safeGetUrlOrigin = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
};

const deriveGitlabExternalId = (payload: any): string | null => {
  const id = payload?.project?.id ?? payload?.project_id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  if (typeof id === 'string' && id.trim()) return id.trim();
  return null;
};

const deriveGitlabApiBaseUrl = (payload: any): string | null => {
  const project = payload?.project ?? {};
  return (
    safeGetUrlOrigin(project.web_url) ||
    safeGetUrlOrigin(project.http_url) ||
    safeGetUrlOrigin(project.git_http_url) ||
    safeGetUrlOrigin(project.http_url_to_repo) ||
    null
  );
};

const safeGetUrlPath = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/\/+$/, '');
    return path ? path : null;
  } catch {
    return null;
  }
};

const stripGitSuffix = (value: string): string => value.replace(/\.git$/i, '');

const normalizeRepoName = (name: string): string =>
  stripGitSuffix(name.trim().replace(/^\/+/, '').replace(/\/+$/, ''));

const deriveGitlabRepoName = (payload: any): string | null => {
  const project = payload?.project ?? {};
  const pathWithNamespace = typeof project.path_with_namespace === 'string' ? normalizeRepoName(project.path_with_namespace) : '';
  if (pathWithNamespace) return pathWithNamespace;

  const pathFromUrl =
    safeGetUrlPath(project.web_url) ||
    safeGetUrlPath(project.http_url) ||
    safeGetUrlPath(project.git_http_url) ||
    safeGetUrlPath(project.http_url_to_repo);
  if (!pathFromUrl) return null;
  return normalizeRepoName(pathFromUrl);
};

const shouldOverwriteRepoName = (existingRaw: string, derivedRaw: string): boolean => {
  const existing = normalizeRepoName(existingRaw);
  const derived = normalizeRepoName(derivedRaw);
  if (!existing || !derived) return false;
  if (existing.includes('/')) return false;
  if (!derived.includes('/')) return false;
  const derivedLast = derived.split('/').pop();
  if (!derivedLast) return false;
  if (derivedLast !== existing) return false;
  return derived !== existing;
};

const deriveGithubExternalId = (payload: any): string | null => {
  const full = typeof payload?.repository?.full_name === 'string' ? payload.repository.full_name.trim() : '';
  if (full) return full;
  const id = payload?.repository?.id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return null;
};

const deriveGithubApiBaseUrl = (payload: any): string | null => {
  const origin = safeGetUrlOrigin(payload?.repository?.html_url) || safeGetUrlOrigin(payload?.repository?.clone_url);
  if (!origin) return null;
  // GitHub.com
  if (origin === 'https://github.com') return 'https://api.github.com';
  // GitHub Enterprise Server: commonly https://HOST/api/v3
  return `${origin}/api/v3`;
};

const deriveGitlabDefaultBranch = (payload: any): string | null => {
  const raw = payload?.project?.default_branch;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

const deriveGithubDefaultBranch = (payload: any): string | null => {
  const raw = payload?.repository?.default_branch;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
};

/**
 * Backfill repository config from the first Webhook payload:
 * - externalId: GitLab uses project.id; GitHub uses owner/repo (full_name)
 * - apiBaseUrl: GitLab uses the origin of web_url; GitHub.com uses https://api.github.com; GHES uses origin + /api/v3
 * - branches: if the branch list is not configured, auto-populate one default branch from default_branch
 *
 * By default, it only fills missing fields to avoid overriding user configuration.
 * Exception (GitLab): when repo.name looks like a short slug missing namespace (no `/`) and webhook payload provides a full
 * `namespace/project` path, normalize repo.name to the full path so that upstream links are correct.
 */
export const buildRepoHydrationPatch = (
  provider: RepoProvider,
  repo: { name?: string | null; externalId?: string | null; apiBaseUrl?: string | null; branches?: RepositoryBranch[] | null },
  payload: any
): RepoHydrationPatch => {
  const patch: RepoHydrationPatch = {};

  if (provider === 'gitlab') {
    const existingName = typeof repo.name === 'string' ? repo.name : '';
    const derivedName = deriveGitlabRepoName(payload);
    if (derivedName && existingName && shouldOverwriteRepoName(existingName, derivedName)) {
      patch.name = derivedName;
    }
  }

  if (!repo.externalId) {
    const derived =
      provider === 'gitlab' ? deriveGitlabExternalId(payload) : provider === 'github' ? deriveGithubExternalId(payload) : null;
    if (derived) patch.externalId = derived;
  }

  if (!repo.apiBaseUrl) {
    const derived =
      provider === 'gitlab' ? deriveGitlabApiBaseUrl(payload) : provider === 'github' ? deriveGithubApiBaseUrl(payload) : null;
    if (derived) patch.apiBaseUrl = derived;
  }

  const existingBranches = Array.isArray(repo.branches) ? repo.branches : [];
  if (!existingBranches.length) {
    const derived =
      provider === 'gitlab'
        ? deriveGitlabDefaultBranch(payload)
        : provider === 'github'
          ? deriveGithubDefaultBranch(payload)
          : null;
    if (derived) patch.branches = [{ name: derived, note: '默认分支（自动回填）', isDefault: true }];
  }

  return patch;
};

/**
 * Derive a minimal "repo identity" from a Webhook payload.
 *
 * Notes:
 * - This is used for binding/validation at webhook ingress; it intentionally does NOT mutate state.
 * - The logic should stay consistent with `buildRepoHydrationPatch()` to avoid "bind says ok but hydration differs".
 */
export const deriveRepoIdentityFromWebhook = (provider: RepoProvider, payload: any): WebhookRepoIdentity => {
  const externalId =
    provider === 'gitlab' ? deriveGitlabExternalId(payload) : provider === 'github' ? deriveGithubExternalId(payload) : null;
  const apiBaseUrl =
    provider === 'gitlab' ? deriveGitlabApiBaseUrl(payload) : provider === 'github' ? deriveGithubApiBaseUrl(payload) : null;
  return { externalId, apiBaseUrl };
};

export const deriveRepoNameFromWebhook = (provider: RepoProvider, payload: any): string | null => {
  if (provider === 'gitlab') return deriveGitlabRepoName(payload);
  if (provider === 'github') {
    const full = typeof payload?.repository?.full_name === 'string' ? payload.repository.full_name.trim() : '';
    if (full) return normalizeRepoName(full);
    const pathFromUrl = safeGetUrlPath(payload?.repository?.html_url) || safeGetUrlPath(payload?.repository?.clone_url);
    if (!pathFromUrl) return null;
    return normalizeRepoName(pathFromUrl);
  }
  return null;
};

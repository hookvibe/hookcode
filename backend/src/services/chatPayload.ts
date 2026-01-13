import type { Repository } from '../types/repository';

/**
 * Chat payload builder (console manual trigger):
 * - Business context: the frontend "Chat" page creates tasks without going through Webhooks.
 * - Purpose: reuse the existing agent pipeline (promptBuilder, repo clone, task list UI) by generating a
 *   webhook-like payload shape that already works with GitLab/GitHub parsers.
 *
 * Change record:
 * - 2026-01-10: Introduced `buildChatTaskPayload()` to support the new `/chat` API.
 *
 * Important notes / assumptions:
 * - This payload intentionally sets `__subType: commented` so templates can use `{{comment.body}}` and
 *   `{{comment.context.*}}` (promptBuilder treats it like a "comment trigger" even though it is console-initiated).
 * - It also sets `__skipProviderPost: true` so the agent will NOT attempt to post results back to GitLab/GitHub.
 * - Clone/web URLs are best-effort derived from `repo.apiBaseUrl` + `repo.name`/`repo.externalId`:
 *   - This works well for GitHub.com and common GitLab setups.
 *   - For uncommon/self-hosted deployments with sub-path routing, prefer configuring `repo.apiBaseUrl` properly.
 */

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const stripGitSuffix = (value: string): string => value.replace(/\.git$/i, '');

const resolveRepoDefaultBranch = (repo: Pick<Repository, 'branches'>): string => {
  const branches = Array.isArray(repo.branches) ? repo.branches : [];
  const byFlag = branches.find((b) => b?.isDefault && safeTrim(b?.name));
  if (byFlag) return safeTrim(byFlag.name);
  const first = branches.find((b) => safeTrim(b?.name));
  return first ? safeTrim(first.name) : '';
};

const normalizeGitlabSiteRoot = (apiBaseUrl: string): string => {
  // Keep consistent with `GitlabService` normalization (strip `/api/v4` if provided).
  const base = stripTrailingSlash(apiBaseUrl);
  return base.replace(/\/api\/v4$/i, '');
};

const normalizeGithubWebRoot = (apiBaseUrl: string): string => {
  const trimmed = stripTrailingSlash(apiBaseUrl);
  if (!trimmed) return 'https://github.com';
  if (trimmed === 'https://api.github.com') return 'https://github.com';
  return trimmed.replace(/\/api\/v3$/i, '');
};

const resolveGitlabCloneAndWebUrl = (repo: Repository): { cloneUrl?: string; webUrl?: string } => {
  const siteRoot = normalizeGitlabSiteRoot(safeTrim(repo.apiBaseUrl) || 'https://gitlab.com');
  const path = stripGitSuffix(safeTrim(repo.name)).replace(/^\/+/, '').replace(/\/+$/, '');
  if (!path) return {};
  return {
    cloneUrl: `${siteRoot}/${path}.git`,
    webUrl: `${siteRoot}/${path}`
  };
};

const resolveGithubSlug = (repo: Repository): string => {
  const externalId = safeTrim(repo.externalId);
  if (externalId.includes('/')) return stripGitSuffix(externalId);
  const name = safeTrim(repo.name);
  if (name.includes('/')) return stripGitSuffix(name);
  return '';
};

const resolveGithubCloneAndWebUrl = (repo: Repository): { slug: string; cloneUrl?: string; webUrl?: string } => {
  const slug = resolveGithubSlug(repo);
  if (!slug) return { slug: '' };

  const apiBaseUrl = safeTrim(repo.apiBaseUrl) || 'https://api.github.com';
  const webRoot = normalizeGithubWebRoot(apiBaseUrl);
  return {
    slug,
    cloneUrl: `${webRoot}/${slug}.git`,
    webUrl: `${webRoot}/${slug}`
  };
};

export const buildChatTaskPayload = (params: {
  repo: Repository;
  text: string;
  author?: string;
}): Record<string, unknown> => {
  const repo = params.repo;
  const text = String(params.text ?? '');
  const author = safeTrim(params.author) || 'console';
  const defaultBranch = resolveRepoDefaultBranch(repo);

  if (repo.provider === 'gitlab') {
    const { cloneUrl, webUrl } = resolveGitlabCloneAndWebUrl(repo);
    const rawExternalId = safeTrim(repo.externalId);
    const projectId =
      rawExternalId && Number.isFinite(Number(rawExternalId)) ? Number(rawExternalId) : rawExternalId || undefined;

    return {
      __subType: 'commented',
      __skipProviderPost: true,
      __chat: { text },
      project: {
        id: projectId,
        path_with_namespace: safeTrim(repo.name),
        web_url: webUrl,
        git_http_url: cloneUrl,
        http_url_to_repo: cloneUrl,
        default_branch: defaultBranch || undefined
      },
      object_attributes: { note: text },
      user: { username: author, name: author }
    };
  }

  if (repo.provider === 'github') {
    const resolved = resolveGithubCloneAndWebUrl(repo);
    const slug = resolved.slug;
    const [owner, repoName] = slug.includes('/') ? slug.split('/') : ['', ''];

    return {
      __subType: 'commented',
      __skipProviderPost: true,
      __chat: { text },
      repository: {
        full_name: slug,
        name: repoName || undefined,
        owner: owner ? { login: owner } : undefined,
        html_url: resolved.webUrl,
        clone_url: resolved.cloneUrl,
        default_branch: defaultBranch || undefined
      },
      comment: { body: text, user: { login: author } },
      sender: { login: author }
    };
  }

  return {
    __subType: 'commented',
    __skipProviderPost: true,
    __chat: { text },
    comment: { body: text, user: { login: author } }
  };
};


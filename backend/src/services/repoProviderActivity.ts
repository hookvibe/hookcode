import type { RepoProvider } from '../types/repository';
import { GithubService, type GithubIssueListItem, type GithubPullRequest, type GithubRepository } from './githubService';
import { GitlabService, type GitlabCommit, type GitlabIssue, type GitlabMergeRequest } from './gitlabService';
import { isGitProviderHttpError } from '../modules/git-providers/git-provider-http-error';

export interface RepoProviderActivityTask {
  id: string;
  status: string;
  title?: string;
  updatedAt?: string;
}

export interface RepoProviderActivityTaskGroup {
  id: string;
  kind: string;
  title?: string;
  updatedAt: string;
  processingTasks?: RepoProviderActivityTask[];
}

export interface RepoProviderActivityItem {
  id: string;
  shortId?: string;
  title: string;
  url?: string;
  state?: string;
  time?: string;
  taskGroups?: RepoProviderActivityTaskGroup[];
}

export interface RepoProviderActivityPage {
  items: RepoProviderActivityItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface RepoProviderActivity {
  commits: RepoProviderActivityPage;
  merges: RepoProviderActivityPage;
  issues: RepoProviderActivityPage;
}

export class RepoProviderAuthRequiredError extends Error {
  code: 'REPO_PROVIDER_AUTH_REQUIRED';
  status: 401;
  providerStatus?: number;

  constructor(params?: { providerStatus?: number; message?: string }) {
    super(params?.message || 'Repo provider authentication is required');
    this.name = 'RepoProviderAuthRequiredError';
    this.code = 'REPO_PROVIDER_AUTH_REQUIRED';
    this.status = 401;
    this.providerStatus = params?.providerStatus;
  }
}

const firstLine = (value: string): string => {
  const line = value.split(/\r?\n/)[0] ?? '';
  return line.trim();
};

const clampPage = (value: unknown, fallback: number): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.floor(num));
};

const clampPageSize = (value: unknown, fallback: number): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(20, Math.floor(num)));
};

const buildPage = (params: { items: RepoProviderActivityItem[]; page: number; pageSize: number }): RepoProviderActivityPage => {
  const hasMore = params.items.length > params.pageSize;
  return {
    items: params.items.slice(0, params.pageSize),
    page: params.page,
    pageSize: params.pageSize,
    hasMore
  };
};

const shortSha = (sha: string): string => sha.slice(0, 7);

const mapGitlabCommit = (commit: GitlabCommit): RepoProviderActivityItem => ({
  id: commit.id,
  shortId: String(commit.short_id ?? '').trim() || shortSha(commit.id),
  title: firstLine(commit.title || commit.message || commit.short_id || commit.id),
  url: commit.web_url,
  ...(commit.created_at ? { time: commit.created_at } : {})
});

const mapGitlabMergeRequest = (mr: GitlabMergeRequest): RepoProviderActivityItem => {
  const time = mr.updated_at || mr.created_at;
  return {
    id: String(mr.iid || mr.id),
    title: firstLine(mr.title || String(mr.iid || mr.id)),
    url: mr.web_url,
    state: mr.state,
    ...(time ? { time } : {})
  };
};

const mapGitlabIssue = (issue: GitlabIssue): RepoProviderActivityItem => {
  const time = issue.updated_at || issue.created_at;
  return {
    id: String(issue.iid || issue.id),
    title: firstLine(issue.title || String(issue.iid || issue.id)),
    url: issue.web_url,
    state: issue.state,
    ...(time ? { time } : {})
  };
};

const mapGithubPullRequest = (pr: GithubPullRequest): RepoProviderActivityItem => {
  const time = pr.updated_at || pr.created_at;
  return {
    id: String(pr.number || pr.id),
    title: firstLine(pr.title || String(pr.number || pr.id)),
    url: pr.html_url,
    state: pr.merged_at ? 'merged' : pr.state,
    ...(time ? { time } : {})
  };
};

const mapGithubIssue = (issue: GithubIssueListItem): RepoProviderActivityItem => {
  const time = issue.updated_at || issue.created_at;
  return {
    id: String(issue.number || issue.id),
    title: firstLine(issue.title || String(issue.number || issue.id)),
    url: issue.html_url,
    state: issue.state,
    ...(time ? { time } : {})
  };
};

const resolveGithubSlug = async (github: GithubService, repoIdentity: string): Promise<{ owner: string; repo: string }> => {
  if (repoIdentity.includes('/')) {
    const [owner, repo] = repoIdentity.split('/');
    if (!owner || !repo) throw new Error('invalid github repo identity (expected owner/repo)');
    return { owner, repo };
  }

  const repoInfo: GithubRepository = await github.getRepositoryById(repoIdentity);
  const fullName = String(repoInfo?.full_name ?? '').trim();
  if (!fullName.includes('/')) throw new Error('failed to resolve github repo full_name');
  const [owner, repo] = fullName.split('/');
  if (!owner || !repo) throw new Error('failed to resolve github owner/repo');
  return { owner, repo };
};

export const fetchRepoProviderActivity = async (params: {
  provider: RepoProvider;
  repoIdentity: string;
  token?: string;
  apiBaseUrl?: string;
  pageSize?: number;
  commitsPage?: number;
  mergesPage?: number;
  issuesPage?: number;
}): Promise<RepoProviderActivity> => {
  // Fetch provider activity (commits/merges/issues) with pagination for the repo detail dashboard row. kzxac35mxk0fg358i7zs
  const provider = params.provider;
  const repoIdentity = String(params.repoIdentity ?? '').trim();
  if (!repoIdentity) throw new Error('repoIdentity is required');

  const token = String(params.token ?? '').trim();
  const apiBaseUrl = String(params.apiBaseUrl ?? '').trim() || undefined;
  const pageSize = clampPageSize(params.pageSize, 5);
  const commitsPage = clampPage(params.commitsPage, 1);
  const mergesPage = clampPage(params.mergesPage, 1);
  const issuesPage = clampPage(params.issuesPage, 1);

  const handleAuthHint = (err: unknown): never => {
    if (!token && isGitProviderHttpError(err) && [401, 403, 404].includes(err.status)) {
      throw new RepoProviderAuthRequiredError({ providerStatus: err.status });
    }
    throw err;
  };

  if (provider === 'gitlab') {
    const gitlab = new GitlabService({ token, baseUrl: apiBaseUrl });
    try {
      return {
        commits: buildPage({
          items: (await gitlab.listCommits(repoIdentity, { perPage: pageSize + 1, page: commitsPage })).map(mapGitlabCommit),
          page: commitsPage,
          pageSize
        }),
        merges: buildPage({
          items: (
            await gitlab.listMergeRequests(repoIdentity, { state: 'merged', perPage: pageSize + 1, page: mergesPage })
          ).map(mapGitlabMergeRequest),
          page: mergesPage,
          pageSize
        }),
        issues: buildPage({
          items: (await gitlab.listIssues(repoIdentity, { state: 'all', perPage: pageSize + 1, page: issuesPage })).map(
            mapGitlabIssue
          ),
          page: issuesPage,
          pageSize
        })
      };
    } catch (err) {
      return handleAuthHint(err);
    }
  }

  if (provider === 'github') {
    // Suppress missing-token warnings when fetching public repo activity in anonymous mode. kzxac35mxk0fg358i7zs
    const github = new GithubService({ token, apiBaseUrl, warnIfNoToken: Boolean(token) });
    try {
      const { owner, repo } = await resolveGithubSlug(github, repoIdentity);

      const commitsRaw = await github.listCommits(owner, repo, { perPage: pageSize + 1, page: commitsPage });
      const commits = buildPage({
        items: commitsRaw.map((c) => ({
          id: c.sha,
          shortId: shortSha(c.sha),
          title: firstLine(String(c.commit?.message ?? c.sha)),
          url: c.html_url
        })),
        page: commitsPage,
        pageSize
      });

      const listFilteredPage = async <T>(options: {
        page: number;
        pageSize: number;
        perPage: number;
        maxPages: number;
        fetchPage: (providerPage: number) => Promise<T[]>;
        filter: (item: T) => boolean;
        map: (item: T) => RepoProviderActivityItem;
      }): Promise<RepoProviderActivityPage> => {
        const offset = (options.page - 1) * options.pageSize;
        const needed = offset + options.pageSize + 1;
        const collected: T[] = [];

        for (let providerPage = 1; providerPage <= options.maxPages; providerPage += 1) {
          const raw = await options.fetchPage(providerPage);
          const filtered = raw.filter(options.filter);
          collected.push(...filtered);
          if (collected.length >= needed) break;
          if (raw.length < options.perPage) break;
        }

        const slice = collected.slice(offset, offset + options.pageSize + 1);
        return buildPage({
          items: slice.map(options.map),
          page: options.page,
          pageSize: options.pageSize
        });
      };

      const merges = await listFilteredPage<GithubPullRequest>({
        page: mergesPage,
        pageSize,
        perPage: 100,
        maxPages: 10,
        fetchPage: (page) => github.listPullRequests(owner, repo, { state: 'closed', sort: 'updated', direction: 'desc', perPage: 100, page }),
        filter: (pr) => Boolean(pr && pr.merged_at),
        map: mapGithubPullRequest
      });

      const issues = await listFilteredPage<GithubIssueListItem>({
        page: issuesPage,
        pageSize,
        perPage: 100,
        maxPages: 10,
        fetchPage: (page) => github.listIssues(owner, repo, { state: 'all', sort: 'updated', direction: 'desc', perPage: 100, page }),
        filter: (issue) => Boolean(issue) && !(issue as any).pull_request,
        map: mapGithubIssue
      });

      return { commits, merges, issues };
    } catch (err) {
      return handleAuthHint(err);
    }
  }

  throw new Error(`unsupported provider: ${provider}`);
};

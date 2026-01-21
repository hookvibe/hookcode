import type { RepoProvider } from '../types/repository';
import { GithubService, type GithubIssueListItem, type GithubPullRequest, type GithubRepository } from './githubService';
import { GitlabService, type GitlabCommit, type GitlabIssue, type GitlabMergeRequest } from './gitlabService';
import { isGitProviderHttpError } from '../modules/git-providers/git-provider-http-error';

export interface RepoProviderActivityItem {
  id: string;
  title: string;
  url?: string;
  state?: string;
  time?: string;
}

export interface RepoProviderActivity {
  commits: RepoProviderActivityItem[];
  merges: RepoProviderActivityItem[];
  issues: RepoProviderActivityItem[];
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

const clampLimit = (value: unknown, fallback: number): number => {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(1, Math.min(10, Math.floor(num)));
};

const mapGitlabCommit = (commit: GitlabCommit): RepoProviderActivityItem => ({
  id: commit.id,
  title: firstLine(commit.title || commit.message || commit.short_id || commit.id),
  url: commit.web_url,
  time: commit.created_at
});

const mapGitlabMergeRequest = (mr: GitlabMergeRequest): RepoProviderActivityItem => ({
  id: String(mr.iid || mr.id),
  title: firstLine(mr.title || String(mr.iid || mr.id)),
  url: mr.web_url,
  state: mr.state
});

const mapGitlabIssue = (issue: GitlabIssue): RepoProviderActivityItem => ({
  id: String(issue.iid || issue.id),
  title: firstLine(issue.title || String(issue.iid || issue.id)),
  url: issue.web_url,
  state: issue.state
});

const mapGithubPullRequest = (pr: GithubPullRequest): RepoProviderActivityItem => ({
  id: String(pr.number || pr.id),
  title: firstLine(pr.title || String(pr.number || pr.id)),
  url: pr.html_url,
  state: pr.state,
  time: pr.updated_at || pr.created_at
});

const mapGithubIssue = (issue: GithubIssueListItem): RepoProviderActivityItem => ({
  id: String(issue.number || issue.id),
  title: firstLine(issue.title || String(issue.number || issue.id)),
  url: issue.html_url,
  state: issue.state,
  time: issue.updated_at || issue.created_at
});

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
  limit?: number;
}): Promise<RepoProviderActivity> => {
  // Fetch provider activity (commits/merges/issues) for the repo detail dashboard row. kzxac35mxk0fg358i7zs
  const provider = params.provider;
  const repoIdentity = String(params.repoIdentity ?? '').trim();
  if (!repoIdentity) throw new Error('repoIdentity is required');

  const token = String(params.token ?? '').trim();
  const apiBaseUrl = String(params.apiBaseUrl ?? '').trim() || undefined;
  const limit = clampLimit(params.limit, 3);

  const handleAuthHint = (err: unknown): never => {
    if (!token && isGitProviderHttpError(err) && [401, 403, 404].includes(err.status)) {
      throw new RepoProviderAuthRequiredError({ providerStatus: err.status });
    }
    throw err;
  };

  if (provider === 'gitlab') {
    const gitlab = new GitlabService({ token, baseUrl: apiBaseUrl });
    try {
      const [commitsRaw, mergesRaw, issuesRaw] = await Promise.all([
        gitlab.listCommits(repoIdentity, { perPage: Math.min(100, Math.max(10, limit)) }),
        gitlab.listMergeRequests(repoIdentity, { state: 'merged', perPage: Math.min(100, Math.max(20, limit)) }),
        gitlab.listIssues(repoIdentity, { state: 'opened', perPage: Math.min(100, Math.max(20, limit)) })
      ]);

      return {
        commits: commitsRaw.slice(0, limit).map(mapGitlabCommit),
        merges: mergesRaw.slice(0, limit).map(mapGitlabMergeRequest),
        issues: issuesRaw.slice(0, limit).map(mapGitlabIssue)
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
      const [commitsRaw, pullsRaw, issuesRaw] = await Promise.all([
        github.listCommits(owner, repo, { perPage: Math.min(100, Math.max(10, limit)) }),
        github.listPullRequests(owner, repo, { state: 'closed', sort: 'updated', direction: 'desc', perPage: 100 }),
        github.listIssues(owner, repo, { state: 'open', sort: 'updated', direction: 'desc', perPage: 100 })
      ]);

      const commits = commitsRaw.slice(0, limit).map((c) => ({
        id: c.sha,
        title: firstLine(String(c.commit?.message ?? c.sha)),
        url: c.html_url
      }));

      const merges = pullsRaw
        .filter((pr) => Boolean(pr && pr.merged_at))
        .slice(0, limit)
        .map(mapGithubPullRequest);

      const issues = issuesRaw
        .filter((issue) => Boolean(issue) && !(issue as any).pull_request)
        .slice(0, limit)
        .map(mapGithubIssue);

      return { commits, merges, issues };
    } catch (err) {
      return handleAuthHint(err);
    }
  }

  throw new Error(`unsupported provider: ${provider}`);
};

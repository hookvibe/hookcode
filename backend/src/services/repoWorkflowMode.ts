import type { RepoProvider } from '../types/repository';
import { GithubService } from './githubService';
import { GitlabService } from './gitlabService';
import { isGitProviderHttpError } from '../modules/git-providers/git-provider-http-error';

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export type RepoWorkflowMode = 'auto' | 'direct' | 'fork';

export const normalizeRepoWorkflowMode = (value: unknown): RepoWorkflowMode | undefined => {
  // Normalize repo workflow mode input from API/UI while preserving auto fallback. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  if (value === undefined || value === null) return undefined;
  const raw = String(value).trim().toLowerCase();
  if (raw === 'auto' || raw === 'direct' || raw === 'fork') return raw as RepoWorkflowMode;
  return undefined;
};

export const resolveRepoWorkflowMode = (value: unknown): RepoWorkflowMode => {
  // Resolve workflow mode defaults to auto so legacy robots retain prior behavior. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  return normalizeRepoWorkflowMode(value) ?? 'auto';
};

const isProviderStatusError = (provider: RepoProvider, status: number, err: unknown): boolean => {
  // Map provider-specific HTTP errors into status checks for fork workflows. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  return isGitProviderHttpError(err) && err.provider === provider && err.status === status;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const ensureGithubForkRepo = async (params: {
  github: GithubService;
  upstream: { owner: string; repo: string };
  log?: (msg: string) => Promise<void>;
}): Promise<{ slug: string; webUrl?: string; cloneUrl?: string } | null> => {
  // Ensure a GitHub fork exists so fork workflows can push to a user-owned repo. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  const log = params.log ?? (async () => undefined);
  const me = await params.github.getCurrentUser();
  const forkOwner = safeTrim(me?.login);
  if (!forkOwner) throw new Error('github current user login is missing');

  const forkSlug = `${forkOwner}/${params.upstream.repo}`;
  try {
    const existing = await params.github.getRepository(forkOwner, params.upstream.repo);
    const parentFull = safeTrim((existing as any)?.parent?.full_name);
    const expectedParent = `${params.upstream.owner}/${params.upstream.repo}`;
    if ((existing as any)?.fork && parentFull.toLowerCase() === expectedParent.toLowerCase()) {
      return {
        slug: forkSlug,
        webUrl: safeTrim((existing as any)?.html_url) || undefined,
        cloneUrl: safeTrim((existing as any)?.clone_url) || undefined
      };
    }
    throw new Error(`existing repo ${forkSlug} is not a fork of ${expectedParent}`);
  } catch (err: any) {
    if (!isProviderStatusError('github', 404, err)) throw err;
  }

  await log(`Creating fork ${forkSlug} for upstream workflow`);
  try {
    await params.github.createFork(params.upstream.owner, params.upstream.repo);
  } catch (err: any) {
    // If the fork already exists, GitHub may return a conflict; fall back to polling. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
    await log(`Fork request failed (will retry lookup): ${err?.message || err}`);
    if (!isProviderStatusError('github', 409, err) && !isProviderStatusError('github', 422, err)) throw err;
  }

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const forkRepo = await params.github.getRepository(forkOwner, params.upstream.repo);
      return {
        slug: forkSlug,
        webUrl: safeTrim((forkRepo as any)?.html_url) || undefined,
        cloneUrl: safeTrim((forkRepo as any)?.clone_url) || undefined
      };
    } catch (err: any) {
      if (!isProviderStatusError('github', 404, err)) throw err;
      await sleep(1500);
    }
  }

  throw new Error(`fork not ready after timeout: ${forkSlug}`);
};

export const ensureGitlabForkProject = async (params: {
  gitlab: GitlabService;
  upstreamProject: string | number;
  log?: (msg: string) => Promise<void>;
}): Promise<{ slug: string; webUrl?: string; cloneUrl?: string } | null> => {
  // Ensure a GitLab fork exists so MR workflows can push to the fork namespace. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  const log = params.log ?? (async () => undefined);
  const upstream = await params.gitlab.getProject(params.upstreamProject);
  const upstreamId = upstream.id;

  const forks = await params.gitlab.listProjectForks(upstreamId, { owned: true, perPage: 100, page: 1 });
  if (forks.length) {
    const picked = forks[0];
    return {
      slug: safeTrim(picked.path_with_namespace),
      webUrl: safeTrim((picked as any)?.web_url) || undefined,
      cloneUrl: safeTrim((picked as any)?.http_url_to_repo) || undefined
    };
  }

  await log(`Creating fork for upstream workflow (project ${upstreamId})`);
  let forked: any;
  try {
    forked = await params.gitlab.forkProject(upstreamId, { mrDefaultTargetSelf: false });
  } catch (err: any) {
    if (!isProviderStatusError('gitlab', 409, err)) throw err;
    const retry = await params.gitlab.listProjectForks(upstreamId, { owned: true, perPage: 100, page: 1 });
    if (!retry.length) throw err;
    forked = retry[0];
  }

  const forkId = typeof forked?.id === 'number' ? forked.id : null;
  if (!forkId) throw new Error('gitlab fork response is missing project id');

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const current = await params.gitlab.getProject(forkId);
    const importStatus = safeTrim((current as any)?.import_status).toLowerCase();
    if (!importStatus || importStatus === 'finished') {
      return {
        slug: safeTrim(current.path_with_namespace),
        webUrl: safeTrim((current as any)?.web_url) || undefined,
        cloneUrl: safeTrim((current as any)?.http_url_to_repo) || undefined
      };
    }
    await sleep(1500);
  }

  throw new Error(`fork not ready after timeout: gitlab project ${forkId}`);
};

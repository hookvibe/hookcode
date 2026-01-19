import type { Task } from '../types/task';

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

// Centralize webhook/chat payload parsing for consistent repo identity extraction. 24yz61mdik7tqdgaa152
export const getGithubRepoSlugFromPayload = (payload: any): { owner: string; repo: string } | null => {
  const full = safeTrim(payload?.repository?.full_name);
  if (full.includes('/')) {
    const [owner, repo] = full.split('/');
    if (owner && repo) return { owner, repo };
  }

  const owner = safeTrim(payload?.repository?.owner?.login);
  const repo = safeTrim(payload?.repository?.name);
  if (owner && repo) return { owner, repo };
  return null;
};

export const getGitlabProjectIdFromPayload = (
  task: Pick<Task, 'projectId'>,
  payload: any
): string | number | null => {
  const id = payload?.project?.id ?? task.projectId;
  if (id === undefined || id === null || id === '') return null;
  return id;
};

export const getGitlabProjectPathWithNamespaceFromPayload = (payload: any): string | null => {
  const path = safeTrim(payload?.project?.path_with_namespace);
  return path ? path : null;
};

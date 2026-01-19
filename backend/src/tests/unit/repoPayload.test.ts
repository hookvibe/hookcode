import { getGithubRepoSlugFromPayload, getGitlabProjectIdFromPayload } from '../../utils/repoPayload';
import type { Task } from '../../types/task';

// Validate shared webhook/chat payload parsing used by the agent and prompt builder. 24yz61mdik7tqdgaa152

describe('repoPayload utils', () => {
  test('getGithubRepoSlugFromPayload prefers repository.full_name', () => {
    expect(getGithubRepoSlugFromPayload({ repository: { full_name: 'octo-org/octo-repo' } })).toEqual({
      owner: 'octo-org',
      repo: 'octo-repo'
    });
  });

  test('getGithubRepoSlugFromPayload falls back to owner.login + name', () => {
    expect(getGithubRepoSlugFromPayload({ repository: { owner: { login: 'octo' }, name: 'repo' } })).toEqual({
      owner: 'octo',
      repo: 'repo'
    });
  });

  test('getGitlabProjectIdFromPayload uses payload.project.id over task.projectId', () => {
    const task = { projectId: 1 } as Pick<Task, 'projectId'>;
    expect(getGitlabProjectIdFromPayload(task, { project: { id: 2 } })).toBe(2);
  });

  test('getGitlabProjectIdFromPayload falls back to task.projectId', () => {
    const task = { projectId: 123 } as Pick<Task, 'projectId'>;
    expect(getGitlabProjectIdFromPayload(task, {})).toBe(123);
  });
});


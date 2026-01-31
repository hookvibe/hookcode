import { describe, expect, test } from 'vitest';
import { parseRoute } from '../router';

describe('router (hash routes)', () => {
  test('treats #/ and #/chat as home', () => {
    expect(parseRoute('#/')).toEqual({ page: 'home' });
    expect(parseRoute('#/chat')).toEqual({ page: 'home' });
  });

  test('parses tasks list route with status filter', () => {
    expect(parseRoute('#/tasks')).toEqual({ page: 'tasks', tasksStatus: undefined });
    expect(parseRoute('#/tasks?status=queued')).toEqual({ page: 'tasks', tasksStatus: 'queued' });
    // Support repo-scoped task list parsing for repo dashboard deep-links. aw85xyfsp5zfg6ihq3jr
    expect(parseRoute('#/tasks?status=processing&repoId=repo_1')).toEqual({ page: 'tasks', tasksStatus: 'processing', tasksRepoId: 'repo_1' });
  });

  test('parses task detail route', () => {
    expect(parseRoute('#/tasks/task_123')).toEqual({ page: 'task', taskId: 'task_123' });
  });

  test('parses task group route', () => {
    expect(parseRoute('#/task-groups/group_1')).toEqual({ page: 'taskGroup', taskGroupId: 'group_1' });
  });

  test('parses task group list route', () => {
    // Ensure the new taskgroup list page is routed separately from the chat view. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    expect(parseRoute('#/task-groups')).toEqual({ page: 'taskGroups' });
  });

  test('parses login route', () => {
    expect(parseRoute('#/login')).toEqual({ page: 'login' });
  });

  test('parses repos routes', () => {
    expect(parseRoute('#/repos')).toEqual({ page: 'repos' });
    expect(parseRoute('#/repos/repo_1')).toEqual({ page: 'repo', repoId: 'repo_1' });
  });

  test('falls back to home for unknown routes', () => {
    expect(parseRoute('#/unknown/path')).toEqual({ page: 'home' });
  });
});

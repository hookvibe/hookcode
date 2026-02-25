// Unit coverage for task git push flow. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
export {};

import { ConflictException } from '@nestjs/common';

jest.mock('fs/promises', () => ({
  __esModule: true,
  stat: jest.fn().mockResolvedValue(undefined)
}));

jest.mock('../../agent/agent', () => {
  return {
    __esModule: true,
    // Provide git proxy flags in the agent mock so push commands don't throw in tests. docs/en/developer/plans/gitpushfix20260127/task_plan.md gitpushfix20260127
    buildGitProxyFlags: jest.fn().mockReturnValue(''),
    // Mock the task-group workspace builder so push paths stay aligned with agent behavior. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    buildTaskGroupWorkspaceDir: jest.fn().mockImplementation(({ taskGroupId, taskId, repoSlug }) => {
      // Mirror the task-group root + repo-name layout when mocking repo paths. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
      const slug = String(repoSlug ?? '').trim();
      const segments = slug.split('__').filter(Boolean);
      const repoName = segments.length > 0 ? segments[segments.length - 1] : slug || 'repo';
      return `/tmp/build/task-groups/${taskGroupId ?? taskId}/${repoName}`;
    }),
    collectGitStatusSnapshot: jest.fn(),
    getRepoCloneUrl: jest.fn().mockReturnValue('https://example.com/upstream.git'),
    getRepoSlug: jest.fn().mockReturnValue('org__repo'),
    injectBasicAuth: jest.fn().mockImplementation((url: string) => ({ execUrl: url, displayUrl: url })),
    resolveCheckoutRef: jest.fn().mockReturnValue({ ref: 'main', source: 'event' }),
    resolveExecution: jest.fn(),
    runCommandCapture: jest.fn(),
    shDoubleQuote: (value: string) => `"${value}"`
  };
});

import { buildTaskGroupWorkspaceDir, collectGitStatusSnapshot, resolveExecution, runCommandCapture } from '../../agent/agent';
import { TaskGitPushService } from '../../modules/tasks/task-git-push.service';

describe('TaskGitPushService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks push when there are no unpushed changes', async () => {
    const taskService = {
      getTask: jest.fn().mockResolvedValue({
        id: 't1',
        groupId: 'g1',
        payload: {},
        result: { gitStatus: { enabled: true, push: { status: 'pushed' } } }
      })
    } as any;

    const service = new TaskGitPushService(taskService, {} as any);

    await expect(service.pushTask('t1')).rejects.toBeInstanceOf(ConflictException);
  });

  test('marks push failure when git push returns a non-zero exit code', async () => {
    const taskService = {
      getTask: jest.fn().mockResolvedValue({
        id: 't2',
        groupId: 'g2',
        payload: {},
        result: {
          repoWorkflow: { mode: 'fork', upstream: { cloneUrl: 'https://example.com/up.git' }, fork: { cloneUrl: 'https://example.com/fork.git' } },
          gitStatus: { enabled: true, push: { status: 'unpushed' }, final: { branch: 'main', headSha: 'abc' } }
        }
      }),
      updateResult: jest.fn().mockResolvedValue(undefined)
    } as any;

    (resolveExecution as jest.Mock).mockResolvedValue({
      provider: 'github',
      repo: { branches: [] },
      robot: { permission: 'write', token: 'tok' },
      repoScopedCredentials: null,
      userCredentials: null
    });

    (runCommandCapture as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd.includes('git rev-parse --abbrev-ref HEAD')) {
        return Promise.resolve({ stdout: 'main', stderr: '', exitCode: 0 });
      }
      if (cmd.includes('git rev-parse HEAD')) {
        return Promise.resolve({ stdout: 'abc', stderr: '', exitCode: 0 });
      }
      if (cmd.includes('git remote get-url --push origin')) {
        return Promise.resolve({ stdout: 'https://example.com/fork.git', stderr: '', exitCode: 0 });
      }
      // Match git push commands even when proxy flags are injected. docs/en/developer/plans/gitpushfix20260127/task_plan.md gitpushfix20260127
      if (cmd.includes('push origin')) {
        return Promise.resolve({ stdout: '', stderr: 'denied', exitCode: 1 });
      }
      return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
    });

    const service = new TaskGitPushService(taskService, {} as any);

    await expect(service.pushTask('t2')).rejects.toBeInstanceOf(ConflictException);
    // Route pushes through the task-group workspace builder to match agent checkout paths. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    expect(buildTaskGroupWorkspaceDir).toHaveBeenCalledWith(
      expect.objectContaining({ taskGroupId: 'g2', taskId: 't2', provider: 'github', repoSlug: 'org__repo' })
    );
    // Capture push failure in task git status so UI can display error. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
    expect(taskService.updateResult).toHaveBeenCalledWith(
      't2',
      expect.objectContaining({ gitStatus: expect.objectContaining({ push: expect.objectContaining({ status: 'error' }) }) })
    );
  });

  test('updates git status after a successful push', async () => {
    const taskService = {
      getTask: jest
        .fn()
        .mockResolvedValueOnce({
          id: 't3',
          groupId: 'g3',
          payload: {},
          result: {
            repoWorkflow: { mode: 'fork', upstream: { cloneUrl: 'https://example.com/up.git' }, fork: { cloneUrl: 'https://example.com/fork.git' } },
            gitStatus: { enabled: true, push: { status: 'unpushed' }, final: { branch: 'main', headSha: 'abc' }, baseline: { branch: 'main', headSha: '000' } }
          }
        })
        .mockResolvedValueOnce({
          id: 't3',
          groupId: 'g3',
          payload: {},
          result: {
            gitStatus: { enabled: true, push: { status: 'pushed' } }
          }
        }),
      updateResult: jest.fn().mockResolvedValue(undefined)
    } as any;

    (resolveExecution as jest.Mock).mockResolvedValue({
      provider: 'github',
      repo: { branches: [] },
      robot: { permission: 'write', token: 'tok' },
      repoScopedCredentials: null,
      userCredentials: null
    });

    (runCommandCapture as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd.includes('git rev-parse --abbrev-ref HEAD')) {
        return Promise.resolve({ stdout: 'main', stderr: '', exitCode: 0 });
      }
      if (cmd.includes('git rev-parse HEAD')) {
        return Promise.resolve({ stdout: 'abc', stderr: '', exitCode: 0 });
      }
      if (cmd.includes('git remote get-url --push origin')) {
        return Promise.resolve({ stdout: 'https://example.com/fork.git', stderr: '', exitCode: 0 });
      }
      // Match git push commands even when proxy flags are injected. docs/en/developer/plans/gitpushfix20260127/task_plan.md gitpushfix20260127
      if (cmd.includes('push origin')) {
        return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
      }
      return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
    });

    (collectGitStatusSnapshot as jest.Mock).mockResolvedValue({
      snapshot: { branch: 'main', headSha: 'abc', pushWebUrl: 'https://example.com/fork' },
      workingTree: { staged: [], unstaged: [], untracked: [] },
      pushTargetSha: 'abc',
      errors: []
    });

    const service = new TaskGitPushService(taskService, {} as any);
    const updated = await service.pushTask('t3');

    expect(updated.id).toBe('t3');
    expect(taskService.updateResult).toHaveBeenCalledWith(
      't3',
      expect.objectContaining({ gitStatus: expect.objectContaining({ push: expect.objectContaining({ status: 'pushed' }) }) })
    );
  });

  test('blocks push when workspace head mismatches captured task head', async () => {
    const taskService = {
      getTask: jest.fn().mockResolvedValue({
        id: 't4',
        groupId: 'g4',
        payload: {},
        result: {
          repoWorkflow: { mode: 'fork', upstream: { cloneUrl: 'https://example.com/up.git' }, fork: { cloneUrl: 'https://example.com/fork.git' } },
          gitStatus: { enabled: true, push: { status: 'unpushed' }, final: { branch: 'main', headSha: 'abc' } }
        }
      }),
      updateResult: jest.fn().mockResolvedValue(undefined)
    } as any;

    (resolveExecution as jest.Mock).mockResolvedValue({
      provider: 'github',
      repo: { branches: [] },
      robot: { permission: 'write', token: 'tok' },
      repoScopedCredentials: null,
      userCredentials: null
    });

    (runCommandCapture as jest.Mock).mockImplementation((cmd: string) => {
      if (cmd.includes('git rev-parse HEAD')) {
        return Promise.resolve({ stdout: 'def', stderr: '', exitCode: 0 });
      }
      return Promise.resolve({ stdout: 'main', stderr: '', exitCode: 0 });
    });

    const service = new TaskGitPushService(taskService, {} as any);

    await expect(service.pushTask('t4')).rejects.toBeInstanceOf(ConflictException);
    expect(taskService.updateResult).toHaveBeenCalledWith(
      't4',
      expect.objectContaining({ gitStatus: expect.objectContaining({ push: expect.objectContaining({ status: 'error' }) }) })
    );
  });
});

// Verify command resolution and env injection so the standalone worker exposes runner-like task context safely. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
import path from 'path';
import { parseWorkerConfig } from '../config';
import {
  buildTaskEnvironment,
  resolveTaskCommand,
  resolveTaskWorkspaceDir,
  summarizeInjectedEnvironment
} from '../runtime/taskCommand';

const config = parseWorkerConfig({
  HOOKCODE_BACKEND_URL: 'https://example.com/api',
  HOOKCODE_WORKER_ID: 'worker-1',
  HOOKCODE_WORKER_TOKEN: 'secret',
  HOOKCODE_WORKER_EXEC_COMMAND: 'echo {{taskId}}'
});

describe('task command resolution', () => {
  test('prefers explicit env template command', () => {
    const resolved = resolveTaskCommand({ id: 'task-1', repoId: 'repo-1' }, config);
    expect(resolved).toEqual({
      command: 'echo task-1',
      source: 'env.HOOKCODE_WORKER_EXEC_COMMAND'
    });
  });

  test('falls back to payload command paths', () => {
    const resolved = resolveTaskCommand(
      {
        id: 'task-2',
        payload: { executor: { command: 'pnpm test' } }
      },
      { ...config, execCommandTemplate: undefined }
    );

    expect(resolved).toEqual({
      command: 'pnpm test',
      source: 'task.payload.executor.command'
    });
  });
});

describe('task environment injection', () => {
  test('builds runner-style env vars and redaction summary', () => {
    const workspaceDir = path.resolve('/tmp', 'group-1');
    const env = buildTaskEnvironment({
      config,
      workspaceDir,
      metadata: { groupId: 'group-1', promptPrefix: 'Use tests first.' },
      context: {
        task: { id: 'task-1', repoId: 'repo-1', robotId: 'robot-1' },
        repo: { provider: 'github', name: 'demo' },
        repoScopedCredentials: { token: 'secret-token' },
        defaultUserCredentials: { email: 'bot@example.com' }
      }
    });

    expect(env.HOOKCODE_TASK_ID).toBe('task-1');
    expect(env.HOOKCODE_REPO_PROVIDER).toBe('github');
    expect(env.HOOKCODE_REPO_CREDENTIALS_TOKEN).toBe('secret-token');
    expect(env.HOOKCODE_SKILL_PROMPT_PREFIX).toBe('Use tests first.');
    expect(summarizeInjectedEnvironment(env).redactedKeys).toContain('HOOKCODE_REPO_CREDENTIALS_TOKEN');
  });

  test('uses task-group id as sticky workspace folder', () => {
    expect(resolveTaskWorkspaceDir('/tmp/workspaces', { id: 'task-1', taskGroupId: 'group-1' })).toBe(
      path.join('/tmp/workspaces', 'group-1')
    );
  });
});

import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import * as agentHelpers from '../../agent/agent';
import { installDependencies } from '../../agent/dependencyInstaller';
import { PreviewLogStream } from '../../modules/tasks/preview-log-stream.service';
import { PreviewService } from '../../modules/tasks/preview.service';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';

// Unit tests for PreviewService config error handling. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

jest.mock('../../agent/dependencyInstaller', () => ({
  // Stub dependency installs so preview reinstall tests do not spawn real commands. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  installDependencies: jest.fn(async () => ({ status: 'success', steps: [], totalDuration: 0 })),
  DependencyInstallerError: class DependencyInstallerError extends Error {}
}));

const PREVIEW_TEST_ROOT = path.join(process.cwd(), '.tmp-preview-tests');

const buildPreviewTestRootDir = (params: { taskGroupId?: string | null; taskId: string }): string =>
  path.join(PREVIEW_TEST_ROOT, params.taskGroupId?.trim() || params.taskId.trim() || 'task');

const buildPreviewTestWorkspaceDir = (params: { taskGroupId?: string | null; taskId: string; repoSlug: string }): string => {
  const segments = String(params.repoSlug ?? '')
    .split('__')
    .filter(Boolean);
  const repoFolder = segments.length > 0 ? segments[segments.length - 1] : 'repo';
  return path.join(buildPreviewTestRootDir(params), repoFolder);
};

describe('PreviewService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Redirect preview workspace builders into a sandbox-safe test root so preview tests avoid ~/.hookcode writes. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    jest.spyOn(agentHelpers, 'buildTaskGroupRootDir').mockImplementation(buildPreviewTestRootDir);
    jest.spyOn(agentHelpers, 'buildTaskGroupWorkspaceDir').mockImplementation(buildPreviewTestWorkspaceDir);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(PREVIEW_TEST_ROOT, { recursive: true, force: true });
  });

  test('returns config_invalid when preview config validation fails', async () => {
    const taskGroupId = 'group-preview-invalid';
    const taskId = 'task-preview-invalid';
    const repoSlug = 'org__repo';
    const workspaceDir = buildPreviewTestWorkspaceDir({
      taskGroupId,
      taskId,
      provider: 'github',
      repoSlug
    } as any);

    await mkdir(workspaceDir, { recursive: true });
    await writeFile(path.join(workspaceDir, '.hookcode.yml'), 'version: 1\npreview:\n  instances: []\n', 'utf8');

    const taskService = {
      getTaskGroup: jest.fn(async () => ({ id: taskGroupId, repoProvider: 'github' })),
      listTasksByGroup: jest.fn(async () => [
        {
          id: taskId,
          repoProvider: 'github',
          payload: { repository: { full_name: 'org/repo' } }
        }
      ])
    };

    // Provide repo-env stub for preview construction. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Provide repo-env stub for preview tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    );

    const status = await previewService.getStatus(taskGroupId);
    expect(status.available).toBe(false);
    expect(status.reason).toBe('config_invalid');

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });

  test('returns workspace_missing snapshot when no task-group workspace exists', async () => {
    // Keep preview status polling on the task-group page in a successful empty state when the workspace has not been created yet. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    const taskGroupId = 'group-preview-missing-workspace';
    const taskService = {
      getTaskGroup: jest.fn(async () => ({ id: taskGroupId, repoProvider: 'github' })),
      listTasksByGroup: jest.fn(async () => [
        {
          id: 'task-preview-missing-workspace',
          repoProvider: 'github',
          payload: { repository: { full_name: 'org/repo' } }
        }
      ])
    };

    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Keep repo-env resolution stubbed for preview status tests. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    );

    const status = await previewService.getStatus(taskGroupId);
    expect(status).toEqual({ available: false, instances: [], reason: 'workspace_missing' });

    await previewService.onModuleDestroy();
  });

  test('resolves workspace from older task payload when latest lacks repo metadata', async () => {
    // Verify preview status finds an existing workspace even if latest payload is missing repo info. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const taskGroupId = 'group-preview-fallback';
    const taskIdOld = 'task-preview-old';
    const taskIdNew = 'task-preview-new';
    const repoSlug = 'org__repo';
    const workspaceDir = buildPreviewTestWorkspaceDir({
      taskGroupId,
      taskId: taskIdOld,
      provider: 'github',
      repoSlug
    } as any);

    await mkdir(workspaceDir, { recursive: true });
    await writeFile(
      path.join(workspaceDir, '.hookcode.yml'),
      [
        'version: 1',
        'preview:',
        '  instances:',
        '    - name: app',
        '      command: "npm run dev"',
        '      workdir: "."'
      ].join('\n'),
      'utf8'
    );

    const taskService = {
      getTaskGroup: jest.fn(async () => ({ id: taskGroupId, repoProvider: 'github' })),
      listTasksByGroup: jest.fn(async () => [
        { id: taskIdNew, repoProvider: 'github', payload: {} },
        { id: taskIdOld, repoProvider: 'github', payload: { repository: { full_name: 'org/repo' } } }
      ])
    };

    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Provide repo-env stub for preview tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    );

    const status = await previewService.getStatus(taskGroupId);
    expect(status.available).toBe(true);
    expect(status.instances[0]?.name).toBe('app');
    // Ensure runtime summaries expose a stable default display mode when config omits it. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
    expect(status.instances[0]?.display).toBe('webview');

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });

  test('installs dependencies via manual preview reinstall', async () => {
    // Validate preview dependency reinstall path for the start modal action. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const taskGroupId = 'group-preview-install';
    const taskId = 'task-preview-install';
    const repoSlug = 'org__repo';
    const workspaceDir = buildPreviewTestWorkspaceDir({
      taskGroupId,
      taskId,
      provider: 'github',
      repoSlug
    } as any);

    await mkdir(workspaceDir, { recursive: true });
    await writeFile(
      path.join(workspaceDir, '.hookcode.yml'),
      [
        'version: 1',
        'dependency:',
        '  failureMode: soft',
        '  runtimes:',
        '    - language: node',
        '      install: "pnpm install --frozen-lockfile"',
        'preview:',
        '  instances:',
        '    - name: app',
        '      command: "npm run dev"',
        '      workdir: "."'
      ].join('\n'),
      'utf8'
    );

    const taskService = {
      getTaskGroup: jest.fn(async () => ({ id: taskGroupId, repoProvider: 'github' })),
      listTasksByGroup: jest.fn(async () => [
        { id: taskId, repoProvider: 'github', payload: { repository: { full_name: 'org/repo' } } }
      ])
    };

    const runtimeService = { hasRuntime: jest.fn(() => true) };
    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      runtimeService as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Provide repo-env stub for preview tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    );

    const result = await previewService.installPreviewDependencies(taskGroupId);
    expect(result.status).toBe('success');
    expect(installDependencies).toHaveBeenCalled();
    const firstCall = (installDependencies as jest.Mock).mock.calls[0]?.[0];
    expect(firstCall?.workspaceDir).toBe(workspaceDir);

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });

  test('stops previews after the hidden timeout elapses', async () => {
    // Validate hidden preview timeout triggers auto-stop for port reclaim. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    jest.useFakeTimers();
    const taskGroupId = 'group-preview-hidden';
    const previewService = new PreviewService(
      {} as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Provide repo-env stub for preview tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    );
    clearInterval((previewService as any).idleTimer);
    const stopPreviewSpy = jest.spyOn(previewService, 'stopPreview').mockResolvedValue();

    (previewService as any).groups.set(taskGroupId, {
      taskGroupId,
      workspaceDir: '/tmp',
      configPath: '/tmp/.hookcode.yml',
      instances: [
        {
          config: { name: 'app', command: 'npm run dev', workdir: '.' },
          port: 12345,
          status: 'running',
          startedAt: new Date().toISOString(),
          lastAccessAt: Date.now(),
          logs: []
        }
      ]
    });

    previewService.markPreviewVisibility(taskGroupId, false);
    jest.advanceTimersByTime(30 * 60 * 1000);
    await Promise.resolve();

    expect(stopPreviewSpy).toHaveBeenCalledWith(taskGroupId);
    stopPreviewSpy.mockRestore();
    (previewService as any).groups.delete(taskGroupId);
    jest.useRealTimers();
  });

  test('starts hidden timeout when previews start without visibility reports', async () => {
    // Ensure previews started without UI visibility still auto-stop after the hidden window. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    jest.useFakeTimers();
    const taskGroupId = 'group-preview-start-hidden';
    const previewService = new PreviewService(
      {} as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Provide repo-env stub for preview tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    );
    clearInterval((previewService as any).idleTimer);
    const stopPreviewSpy = jest.spyOn(previewService, 'stopPreview').mockResolvedValue();

    const instanceConfig = { name: 'app', command: 'npm run dev', workdir: '.' };
    jest.spyOn(previewService as any, 'resolvePreviewConfig').mockResolvedValue({
      available: true,
      workspaceDir: '/tmp',
      config: { version: 1, preview: { instances: [instanceConfig] } },
      snapshot: { available: true, instances: [] }
    });
    jest.spyOn(previewService as any, 'installDependenciesIfNeeded').mockResolvedValue(null);
    // Stub new port-map + repo-env hooks so hidden-timeout coverage remains deterministic. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    jest.spyOn(previewService as any, 'allocatePreviewPorts').mockResolvedValue({ app: 12347 });
    jest.spyOn(previewService as any, 'resolveRepoPreviewEnv').mockResolvedValue({});
    jest.spyOn(previewService as any, 'assertNamedPortPlaceholders').mockImplementation(() => {});
    jest.spyOn(previewService as any, 'startInstance').mockResolvedValue({
      config: instanceConfig,
      port: 12347,
      status: 'running',
      startedAt: new Date().toISOString(),
      lastAccessAt: Date.now(),
      logs: []
    });
    jest.spyOn(previewService as any, 'ensureConfigWatcher').mockImplementation(() => {});
    jest.spyOn(previewService as any, 'resolveConfigPath').mockReturnValue('/tmp/.hookcode.yml');

    await (previewService as any).startPreviewInternal(taskGroupId);
    stopPreviewSpy.mockClear();
    jest.advanceTimersByTime(30 * 60 * 1000);
    await Promise.resolve();

    expect(stopPreviewSpy).toHaveBeenCalledWith(taskGroupId);
    stopPreviewSpy.mockRestore();
    (previewService as any).groups.delete(taskGroupId);
    jest.useRealTimers();
  });

  test('clears hidden timers when preview becomes visible again', async () => {
    // Ensure preview visibility updates cancel pending hidden shutdowns. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8
    jest.useFakeTimers();
    const taskGroupId = 'group-preview-visible';
    const previewService = new PreviewService(
      {} as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any // Provide repo-env stub for preview tests. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    );
    clearInterval((previewService as any).idleTimer);
    const stopPreviewSpy = jest.spyOn(previewService, 'stopPreview').mockResolvedValue();

    (previewService as any).groups.set(taskGroupId, {
      taskGroupId,
      workspaceDir: '/tmp',
      configPath: '/tmp/.hookcode.yml',
      instances: [
        {
          config: { name: 'app', command: 'npm run dev', workdir: '.' },
          port: 12346,
          status: 'running',
          startedAt: new Date().toISOString(),
          lastAccessAt: Date.now(),
          logs: []
        }
      ]
    });

    previewService.markPreviewVisibility(taskGroupId, false);
    previewService.markPreviewVisibility(taskGroupId, true);
    jest.advanceTimersByTime(30 * 60 * 1000);
    await Promise.resolve();

    expect(stopPreviewSpy).not.toHaveBeenCalled();
    stopPreviewSpy.mockRestore();
    (previewService as any).groups.delete(taskGroupId);
    jest.useRealTimers();
  });

  test('returns admin overview with active groups and port allocation snapshots', async () => {
    // Verify preview management overview combines runtime groups and port pool snapshots. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    const taskService = {
      getTaskGroup: jest.fn(async (id: string) => ({
        id,
        title: id === 'group-a' ? 'Group A' : 'Group B',
        repoId: id === 'group-a' ? 'repo-1' : 'repo-2'
      }))
    };
    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any
    );
    clearInterval((previewService as any).idleTimer);

    (previewService as any).groups.set('group-a', {
      taskGroupId: 'group-a',
      workspaceDir: '/tmp/a',
      configPath: '/tmp/a/.hookcode.yml',
      instances: [
        {
          config: { name: 'frontend', command: 'pnpm dev', workdir: '.' },
          port: 10000,
          status: 'running',
          startedAt: new Date().toISOString(),
          lastAccessAt: Date.now(),
          logs: []
        }
      ]
    });
    (previewService as any).groups.set('group-b', {
      taskGroupId: 'group-b',
      workspaceDir: '/tmp/b',
      configPath: '/tmp/b/.hookcode.yml',
      instances: [
        {
          config: { name: 'admin', command: 'pnpm dev', workdir: '.' },
          port: 10001,
          status: 'starting',
          startedAt: new Date().toISOString(),
          lastAccessAt: Date.now(),
          logs: []
        }
      ]
    });
    (previewService as any).portPool.inUse.add(10000);
    (previewService as any).portPool.inUse.add(10001);
    (previewService as any).portPool.allocations.set('group-a', [10000]);
    (previewService as any).portPool.allocations.set('group-b', [10001]);

    const overview = await previewService.getPreviewAdminOverview();
    expect(overview.activeTaskGroups).toHaveLength(2);
    expect(overview.activeTaskGroups[0]?.taskGroupId).toBe('group-a');
    expect(overview.activeTaskGroups[0]?.aggregateStatus).toBe('running');
    expect(overview.activeTaskGroups[1]?.taskGroupId).toBe('group-b');
    expect(overview.activeTaskGroups[1]?.aggregateStatus).toBe('starting');
    // Keep admin snapshots explicit about display mode for per-instance terminal/webview management. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
    expect(overview.activeTaskGroups[0]?.instances[0]?.display).toBe('webview');
    expect(overview.portAllocation.inUseCount).toBe(2);
    expect(overview.portAllocation.allocations).toEqual(
      expect.arrayContaining([
        { taskGroupId: 'group-a', ports: [10000] },
        { taskGroupId: 'group-b', ports: [10001] }
      ])
    );

    await previewService.onModuleDestroy();
  });

  test('includes active preview groups in repo preview config responses', async () => {
    // Ensure repo detail preview APIs can show running preview task groups even when config discovery is unavailable. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    const taskService = {
      listTaskGroups: jest.fn(async () => []),
      getTaskGroup: jest.fn(async () => ({ id: 'group-a', title: 'Group A', repoId: 'repo-1' }))
    };
    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any
    );
    clearInterval((previewService as any).idleTimer);

    (previewService as any).groups.set('group-a', {
      taskGroupId: 'group-a',
      workspaceDir: '/tmp/a',
      configPath: '/tmp/a/.hookcode.yml',
      instances: [
        {
          config: { name: 'frontend', command: 'pnpm dev', workdir: '.' },
          port: 10002,
          status: 'running',
          startedAt: new Date().toISOString(),
          lastAccessAt: Date.now(),
          logs: []
        }
      ]
    });

    const response = await previewService.getRepoPreviewConfig('repo-1');
    expect(response.available).toBe(false);
    expect(response.reason).toBe('no_workspace');
    expect(response.activeTaskGroups).toHaveLength(1);
    expect(response.activeTaskGroups[0]?.taskGroupId).toBe('group-a');
    expect(response.activeTaskGroups[0]?.instances[0]?.status).toBe('running');
    // Ensure repo preview management payloads include display mode for active runtime entries. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
    expect(response.activeTaskGroups[0]?.instances[0]?.display).toBe('webview');

    await previewService.onModuleDestroy();
  });

  test('returns repo preview config instances with explicit display mode', async () => {
    // Verify repo-level preview config discovery exposes terminal/webview mode before runtime startup. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
    const taskGroupId = 'group-preview-repo-display';
    const taskId = 'task-preview-repo-display';
    const repoSlug = 'org__repo_display';
    const repoId = 'repo-display';
    const workspaceDir = buildPreviewTestWorkspaceDir({
      taskGroupId,
      taskId,
      provider: 'github',
      repoSlug
    } as any);

    await mkdir(workspaceDir, { recursive: true });
    await writeFile(
      path.join(workspaceDir, '.hookcode.yml'),
      [
        'version: 1',
        'preview:',
        '  instances:',
        '    - name: backend',
        '      command: "pnpm dev"',
        '      workdir: backend',
        '      display: terminal'
      ].join('\n'),
      'utf8'
    );

    const taskService = {
      listTaskGroups: jest.fn(async () => [{ id: taskGroupId, repoId, repoProvider: 'github' }]),
      getTaskGroup: jest.fn(async () => ({ id: taskGroupId, repoId, repoProvider: 'github' })),
      listTasksByGroup: jest.fn(async () => [
        {
          id: taskId,
          repoProvider: 'github',
          payload: { repository: { full_name: 'org/repo_display' } }
        }
      ])
    };
    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream(),
      { getRepoPreviewEnv: jest.fn(async () => ({})) } as any
    );
    clearInterval((previewService as any).idleTimer);

    const response = await previewService.getRepoPreviewConfig(repoId);
    expect(response.available).toBe(true);
    expect(response.instances[0]?.name).toBe('backend');
    expect(response.instances[0]?.display).toBe('terminal');

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });
});

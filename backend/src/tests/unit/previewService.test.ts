import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { buildTaskGroupWorkspaceDir } from '../../agent/agent';
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

describe('PreviewService', () => {
  test('returns config_invalid when preview config validation fails', async () => {
    const taskGroupId = 'group-preview-invalid';
    const taskId = 'task-preview-invalid';
    const repoSlug = 'org__repo';
    const workspaceDir = buildTaskGroupWorkspaceDir({
      taskGroupId,
      taskId,
      provider: 'github',
      repoSlug
    });

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

    const previewService = new PreviewService(
      taskService as any,
      new HookcodeConfigService(),
      {} as any,
      new PreviewLogStream()
    );

    const status = await previewService.getStatus(taskGroupId);
    expect(status.available).toBe(false);
    expect(status.reason).toBe('config_invalid');

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });

  test('resolves workspace from older task payload when latest lacks repo metadata', async () => {
    // Verify preview status finds an existing workspace even if latest payload is missing repo info. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const taskGroupId = 'group-preview-fallback';
    const taskIdOld = 'task-preview-old';
    const taskIdNew = 'task-preview-new';
    const repoSlug = 'org__repo';
    const workspaceDir = buildTaskGroupWorkspaceDir({
      taskGroupId,
      taskId: taskIdOld,
      provider: 'github',
      repoSlug
    });

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
      new PreviewLogStream()
    );

    const status = await previewService.getStatus(taskGroupId);
    expect(status.available).toBe(true);
    expect(status.instances[0]?.name).toBe('app');

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });

  test('installs dependencies via manual preview reinstall', async () => {
    // Validate preview dependency reinstall path for the start modal action. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const taskGroupId = 'group-preview-install';
    const taskId = 'task-preview-install';
    const repoSlug = 'org__repo';
    const workspaceDir = buildTaskGroupWorkspaceDir({
      taskGroupId,
      taskId,
      provider: 'github',
      repoSlug
    });

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
      new PreviewLogStream()
    );

    const result = await previewService.installPreviewDependencies(taskGroupId);
    expect(result.status).toBe('success');
    expect(installDependencies).toHaveBeenCalled();
    const firstCall = (installDependencies as jest.Mock).mock.calls[0]?.[0];
    expect(firstCall?.workspaceDir).toBe(workspaceDir);

    await previewService.onModuleDestroy();
    await rm(workspaceDir, { recursive: true, force: true });
  });
});

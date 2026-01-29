import { mkdir, rm, writeFile } from 'fs/promises';
import path from 'path';
import { buildTaskGroupWorkspaceDir } from '../../agent/agent';
import { PreviewLogStream } from '../../modules/tasks/preview-log-stream.service';
import { PreviewService } from '../../modules/tasks/preview.service';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';

// Unit tests for PreviewService config error handling. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as

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
});

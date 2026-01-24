// Unit coverage for task-group workspace path builder. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
export {};

import path from 'path';
import { buildTaskGroupWorkspaceDir, TASK_GROUP_WORKSPACE_ROOT } from '../../agent/agent';

describe('buildTaskGroupWorkspaceDir', () => {
  test('uses task group id when available', () => {
    const result = buildTaskGroupWorkspaceDir({
      taskGroupId: 'group-123',
      taskId: 'task-ignored',
      provider: 'github',
      repoSlug: 'org__repo'
    });

    // Ensure task group ids drive the workspace path to keep a 1:1 mapping. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'group-123__github__org__repo'));
  });

  test('falls back to task id when group id is missing', () => {
    const result = buildTaskGroupWorkspaceDir({
      taskGroupId: null,
      taskId: 'task-789',
      provider: 'gitlab',
      repoSlug: 'space__repo'
    });

    // Maintain deterministic fallback paths when task group ids are unavailable. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'task-789__gitlab__space__repo'));
  });
});

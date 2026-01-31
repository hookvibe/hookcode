// Unit coverage for task-group workspace path builder. docs/en/developer/plans/tgpull2wkg7n9f4a/task_plan.md tgpull2wkg7n9f4a
export {};

import path from 'path';
import { buildTaskGroupRootDir, buildTaskGroupWorkspaceDir, TASK_GROUP_WORKSPACE_ROOT } from '../../agent/agent';

describe('buildTaskGroupWorkspaceDir', () => {
  test('maps task group ids to root directories', () => {
    const result = buildTaskGroupRootDir({ taskGroupId: 'group-root', taskId: 'task-root' });

    // Keep task-group root directories stable for shared artifacts. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'group-root'));
  });

  test('uses task group id when available', () => {
    const result = buildTaskGroupWorkspaceDir({
      taskGroupId: 'group-123',
      taskId: 'task-ignored',
      provider: 'github',
      repoSlug: 'org__repo'
    });

    // Ensure task group ids drive the root path while repo name lives under the group. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'group-123', 'repo'));
  });

  test('falls back to task id when group id is missing', () => {
    const result = buildTaskGroupWorkspaceDir({
      taskGroupId: null,
      taskId: 'task-789',
      provider: 'gitlab',
      repoSlug: 'space__repo'
    });

    // Maintain deterministic fallback paths when task group ids are unavailable. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
    expect(result).toBe(path.join(TASK_GROUP_WORKSPACE_ROOT, 'task-789', 'repo'));
  });
});

// Unit coverage for build root selection precedence. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export {};

import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

describe('BUILD_ROOT resolution', () => {
  test('uses HOOKCODE_BUILD_ROOT when it exists', async () => {
    // Honor explicit build roots to align preview workspaces across runtime modes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    const dir = await mkdtemp(path.join(tmpdir(), 'hookcode-build-'));
    const original = process.env.HOOKCODE_BUILD_ROOT;
    process.env.HOOKCODE_BUILD_ROOT = dir;

    jest.resetModules();
    const agent = await import('../../agent/agent');
    expect(agent.BUILD_ROOT).toBe(dir);

    if (original === undefined) {
      delete process.env.HOOKCODE_BUILD_ROOT;
    } else {
      process.env.HOOKCODE_BUILD_ROOT = original;
    }
    await rm(dir, { recursive: true, force: true });
  });

  test('resolves task-group root relative to build root override', async () => {
    // Keep task-group roots configurable for shared task-group workspaces. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
    const dir = await mkdtemp(path.join(tmpdir(), 'hookcode-build-'));
    const originalBuildRoot = process.env.HOOKCODE_BUILD_ROOT;
    const originalTaskGroupsRoot = process.env.HOOKCODE_TASK_GROUPS_ROOT;
    process.env.HOOKCODE_BUILD_ROOT = dir;
    process.env.HOOKCODE_TASK_GROUPS_ROOT = 'custom-task-groups';

    jest.resetModules();
    const agent = await import('../../agent/agent');
    expect(agent.TASK_GROUP_WORKSPACE_ROOT).toBe(path.join(dir, 'custom-task-groups'));

    if (originalBuildRoot === undefined) {
      delete process.env.HOOKCODE_BUILD_ROOT;
    } else {
      process.env.HOOKCODE_BUILD_ROOT = originalBuildRoot;
    }
    if (originalTaskGroupsRoot === undefined) {
      delete process.env.HOOKCODE_TASK_GROUPS_ROOT;
    } else {
      process.env.HOOKCODE_TASK_GROUPS_ROOT = originalTaskGroupsRoot;
    }
    await rm(dir, { recursive: true, force: true });
  });
});

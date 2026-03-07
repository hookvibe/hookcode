// Unit coverage for build root selection precedence. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export {};

import { mkdtemp, rm } from 'fs/promises';
import { homedir, tmpdir } from 'os';
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

  test('defaults task-group root to HOOKCODE_WORK_DIR/task-groups', async () => {
    // Keep backend task-group workspaces under the shared HookCode work root when no explicit override is provided. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const originalBuildRoot = process.env.HOOKCODE_BUILD_ROOT;
    const originalWorkDir = process.env.HOOKCODE_WORK_DIR;
    delete process.env.HOOKCODE_WORK_DIR;

    jest.resetModules();
    const agent = await import('../../agent/agent');
    expect(agent.TASK_GROUP_WORKSPACE_ROOT).toBe(path.join(homedir(), '.hookcode', 'task-groups'));

    if (originalBuildRoot === undefined) {
      delete process.env.HOOKCODE_BUILD_ROOT;
    } else {
      process.env.HOOKCODE_BUILD_ROOT = originalBuildRoot;
    }
    if (originalWorkDir === undefined) {
      delete process.env.HOOKCODE_WORK_DIR;
    } else {
      process.env.HOOKCODE_WORK_DIR = originalWorkDir;
    }
  });

  test('resolves task-group root relative to unified work dir override', async () => {
    // Keep work-root overrides relative to BUILD_ROOT in backend mode so operators can relocate all HookCode state together. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const dir = await mkdtemp(path.join(tmpdir(), 'hookcode-build-'));
    const originalBuildRoot = process.env.HOOKCODE_BUILD_ROOT;
    const originalWorkDir = process.env.HOOKCODE_WORK_DIR;
    process.env.HOOKCODE_BUILD_ROOT = dir;
    process.env.HOOKCODE_WORK_DIR = 'custom-work-root';

    jest.resetModules();
    const agent = await import('../../agent/agent');
    expect(agent.TASK_GROUP_WORKSPACE_ROOT).toBe(path.join(dir, 'custom-work-root', 'task-groups'));

    if (originalBuildRoot === undefined) {
      delete process.env.HOOKCODE_BUILD_ROOT;
    } else {
      process.env.HOOKCODE_BUILD_ROOT = originalBuildRoot;
    }
    if (originalWorkDir === undefined) {
      delete process.env.HOOKCODE_WORK_DIR;
    } else {
      process.env.HOOKCODE_WORK_DIR = originalWorkDir;
    }
    await rm(dir, { recursive: true, force: true });
  });

  test('expands tilde in unified work dir overrides', async () => {
    // Validate "~" expansion so HOOKCODE_WORK_DIR can point at the user home while keeping task-groups under a stable subdirectory. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    const dir = await mkdtemp(path.join(tmpdir(), 'hookcode-build-'));
    const originalBuildRoot = process.env.HOOKCODE_BUILD_ROOT;
    const originalWorkDir = process.env.HOOKCODE_WORK_DIR;
    process.env.HOOKCODE_BUILD_ROOT = dir;
    process.env.HOOKCODE_WORK_DIR = '~/.custom-hookcode';

    jest.resetModules();
    const agent = await import('../../agent/agent');
    expect(agent.TASK_GROUP_WORKSPACE_ROOT).toBe(path.join(homedir(), '.custom-hookcode', 'task-groups'));

    if (originalBuildRoot === undefined) {
      delete process.env.HOOKCODE_BUILD_ROOT;
    } else {
      process.env.HOOKCODE_BUILD_ROOT = originalBuildRoot;
    }
    if (originalWorkDir === undefined) {
      delete process.env.HOOKCODE_WORK_DIR;
    } else {
      process.env.HOOKCODE_WORK_DIR = originalWorkDir;
    }
    await rm(dir, { recursive: true, force: true });
  });
});

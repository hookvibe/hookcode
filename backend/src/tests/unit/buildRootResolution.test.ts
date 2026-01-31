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
});

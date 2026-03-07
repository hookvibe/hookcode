// Verify unified work-dir helpers keep runtime storage paths anchored under HOOKCODE_WORK_DIR. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export {};

import { homedir } from 'os';
import path from 'path';
import { DEFAULT_WORK_DIR, expandHomePath, resolveWorkDirOverridePath } from '../../utils/workDir';

describe('workDir helpers', () => {
  test('expands the default work dir to the current user home', () => {
    expect(expandHomePath(DEFAULT_WORK_DIR)).toBe(path.join(homedir(), '.hookcode'));
  });

  test('resolves relative runtime-data override paths beneath the shared work dir', () => {
    // Cover runtime-data overrides after deleting the migration-dir env so auth-secret style paths still anchor under HOOKCODE_WORK_DIR. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    expect(resolveWorkDirOverridePath('/tmp/hookcode-root', 'auth/auth-token-secret')).toBe('/tmp/hookcode-root/auth/auth-token-secret');
  });

  test('keeps absolute override paths unchanged', () => {
    expect(resolveWorkDirOverridePath('/tmp/hookcode-root', '/var/lib/hookcode/secret.txt')).toBe('/var/lib/hookcode/secret.txt');
  });

  test('expands tilde override paths before resolution', () => {
    expect(resolveWorkDirOverridePath('/tmp/hookcode-root', '~/.hookcode/auth-secret')).toBe(
      path.join(homedir(), '.hookcode', 'auth-secret')
    );
  });
});

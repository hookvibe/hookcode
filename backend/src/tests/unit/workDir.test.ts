// Verify unified work-dir helpers keep runtime storage paths anchored under HOOKCODE_WORK_DIR. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export {};

import { homedir } from 'os';
import path from 'path';
import { DEFAULT_WORK_DIR, expandHomePath, resolveWorkDirOverridePath } from '../../utils/workDir';

describe('workDir helpers', () => {
  // Build expected paths with Node's path helpers so the assertions stay valid on Windows and POSIX. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
  const workDirRoot = path.join(path.sep, 'tmp', 'hookcode-root');
  const absoluteSecretPath = path.join(path.sep, 'var', 'lib', 'hookcode', 'secret.txt');

  test('expands the default work dir to the current user home', () => {
    expect(expandHomePath(DEFAULT_WORK_DIR)).toBe(path.join(homedir(), '.hookcode'));
  });

  test('resolves relative runtime-data override paths beneath the shared work dir', () => {
    // Cover runtime-data overrides after deleting the migration-dir env so auth-secret style paths still anchor under HOOKCODE_WORK_DIR. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
    expect(resolveWorkDirOverridePath(workDirRoot, 'auth/auth-token-secret')).toBe(
      path.join(workDirRoot, 'auth', 'auth-token-secret')
    );
  });

  test('keeps absolute override paths unchanged', () => {
    expect(resolveWorkDirOverridePath(workDirRoot, absoluteSecretPath)).toBe(absoluteSecretPath);
  });

  test('expands tilde override paths before resolution', () => {
    expect(resolveWorkDirOverridePath(workDirRoot, '~/.hookcode/auth-secret')).toBe(
      path.join(homedir(), '.hookcode', 'auth-secret')
    );
  });
});

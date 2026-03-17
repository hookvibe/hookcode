/**
 * Cross-platform child_process helpers for the worker package.
 *
 * Mirrors backend/src/utils/crossPlatformSpawn.ts — kept as a separate copy because
 * `worker` is an independent package that cannot import from `backend`.
 *
 * docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
 */
import { spawn, execFileSync, type SpawnOptions, type ExecFileSyncOptions, type ChildProcess } from 'child_process';

const IS_WIN = process.platform === 'win32';

// Cross-platform spawn wrapper to resolve .cmd shim issues on Windows (Node v24+). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xSpawn = (command: string, args: string[], opts?: SpawnOptions): ChildProcess => {
  return spawn(command, args, { ...opts, shell: opts?.shell ?? IS_WIN });
};

// Cross-platform execFileSync wrapper. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xExecFileSync = (file: string, args: string[], opts?: ExecFileSyncOptions): Buffer | string => {
  return execFileSync(file, args, { ...opts, shell: opts?.shell ?? IS_WIN });
};

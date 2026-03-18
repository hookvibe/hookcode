/**
 * Cross-platform child_process helpers for the worker package.
 *
 * Mirrors backend/src/utils/crossPlatformSpawn.ts — kept as a separate copy because
 * `worker` is an independent package that cannot import from `backend`.
 *
 * docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
 */
import {
  spawn,
  spawnSync,
  execFileSync,
  type SpawnOptions,
  type SpawnSyncOptions,
  type SpawnSyncReturns,
  type ExecFileSyncOptions,
  type ChildProcess
} from 'child_process';

const IS_WIN = process.platform === 'win32';

// Cross-platform spawn wrapper to resolve .cmd shim issues on Windows (Node v24+). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xSpawn = (command: string, args: string[], opts?: SpawnOptions): ChildProcess => {
  return spawn(command, args, { ...opts, shell: opts?.shell ?? IS_WIN });
};

// Keep sync binary probes compatible with Windows `.cmd` shims so worker capability and package-manager detection stay accurate. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
export const xSpawnSync = (command: string, args: string[], opts?: SpawnSyncOptions): SpawnSyncReturns<Buffer | string> => {
  return spawnSync(command, args, { ...opts, shell: opts?.shell ?? IS_WIN });
};

// Cross-platform execFileSync wrapper. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xExecFileSync = (file: string, args: string[], opts?: ExecFileSyncOptions): Buffer | string => {
  return execFileSync(file, args, { ...opts, shell: opts?.shell ?? IS_WIN });
};

// Stop shell-wrapped worker commands through the full process tree on Windows so cancellations do not leave child tools running. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
export const stopChildProcessTree = (child: Pick<ChildProcess, 'pid' | 'kill' | 'exitCode' | 'signalCode'>, signal: 'SIGTERM' | 'SIGKILL'): void => {
  if (child.exitCode !== null || child.signalCode) return;

  const pid = typeof child.pid === 'number' ? child.pid : 0;
  if (pid > 0 && IS_WIN) {
    try {
      execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
      return;
    } catch {
      // Fall back to child.kill when taskkill is unavailable or the process already exited. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
    }
  }

  if (pid > 0 && !IS_WIN) {
    try {
      process.kill(-pid, signal);
      return;
    } catch {
      // Fall back to the direct child when the process was not started as its own group leader. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
    }
  }

  try {
    child.kill(signal);
  } catch {
    // Ignore double-kill races because worker shutdown is best effort during task cancellation. docs/en/developer/plans/crossplatformcompat20260318/task_plan.md crossplatformcompat20260318
  }
};

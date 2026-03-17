/**
 * Cross-platform child_process helpers.
 *
 * Business module: Utils / Cross-platform compatibility
 * Purpose: Ensure spawn/exec calls work identically on Windows, macOS, and Linux.
 *
 * Problem: Node.js v24+ on Windows raises EINVAL when spawning `.cmd` shims (pnpm, npx, git)
 * without `shell: true`, and `sh -c` does not exist on Windows at all.
 *
 * Usage: Import these helpers instead of raw `spawn`/`execSync`/`execFileSync` in any file
 * that invokes external commands (git, pnpm, sh, etc.).
 *
 * docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
 */
import { spawn, execSync, execFileSync, type SpawnOptions, type ExecSyncOptions, type ExecFileSyncOptions, type ChildProcess } from 'child_process';

const IS_WIN = process.platform === 'win32';

/**
 * On Windows, commands like `git`, `pnpm`, `npx` are actually `.cmd` shims.
 * Node.js v24+ raises EINVAL when spawning `.cmd` files without `shell: true`.
 * This helper injects `shell: true` on Windows into any SpawnOptions object.
 */
// Inject Windows shell flag into spawn options. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xpSpawnOpts = <T extends SpawnOptions>(opts: T): T => {
  if (IS_WIN && opts.shell === undefined) {
    return { ...opts, shell: true };
  }
  return opts;
};

/**
 * Spawn a shell command string (`sh -c "..."` on POSIX, `cmd /c "..."` on Windows).
 * Use this when the caller passes a full command string that needs shell interpretation.
 */
// Cross-platform shell command spawner for POSIX sh/Windows cmd. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xSpawnShell = (command: string, opts?: SpawnOptions): ChildProcess => {
  if (IS_WIN) {
    return spawn(process.env.COMSPEC || 'cmd.exe', ['/c', command], { ...(opts ?? {}), shell: false });
  }
  return spawn('sh', ['-c', command], opts ?? {});
};

/**
 * `execSync` wrapper — ensures shell resolution on Windows.
 */
// Cross-platform execSync wrapper. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xExecSync = (command: string, opts?: ExecSyncOptions): Buffer | string => {
  const shell: string | undefined = (opts?.shell ?? IS_WIN) ? (IS_WIN ? (process.env.COMSPEC || 'cmd.exe') : '/bin/sh') : undefined;
  return execSync(command, { ...opts, shell });
};

/**
 * `execFileSync` wrapper — adds `shell: true` on Windows for `.cmd` shim resolution.
 */
// Cross-platform execFileSync wrapper. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const xExecFileSync = (file: string, args: string[], opts?: ExecFileSyncOptions): Buffer | string => {
  return execFileSync(file, args, { ...opts, shell: opts?.shell ?? IS_WIN });
};

/**
 * Resolve a command's absolute path cross-platform (`command -v` on POSIX, `where` on Windows).
 * Returns the path string or null if not found.
 */
// Cross-platform command resolution (replaces `sh -lc "command -v ..."`). docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
export const resolveCommandPath = async (cmd: string): Promise<string | null> => {
  const { execFile } = await import('child_process');
  const { promisify } = await import('util');
  const execFileAsync = promisify(execFile);

  try {
    if (IS_WIN) {
      const { stdout } = await execFileAsync('where', [cmd], { timeout: 3000 });
      // `where` may return multiple lines; take the first match
      const first = stdout.trim().split(/\r?\n/)[0]?.trim();
      return first || null;
    }
    const { stdout } = await execFileAsync('sh', ['-lc', `command -v ${cmd}`], { timeout: 3000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
};

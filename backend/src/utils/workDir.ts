import { existsSync } from 'fs';
import { homedir } from 'os';
import path from 'path';

export const DEFAULT_WORK_DIR = '~/.hookcode';

const trimString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const expandHomePath = (value: string): string => {
  // Expand leading "~" consistently so every HookCode storage path can share the same work-dir semantics. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  if (value === '~') return homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(homedir(), value.slice(2));
  return value;
};

export const resolveBuildRoot = (): string => {
  // Resolve the backend build root deterministically so relative work directories stay stable across src/dist entrypoints. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const explicit = trimString(process.env.HOOKCODE_BUILD_ROOT);
  if (explicit && existsSync(expandHomePath(explicit))) return expandHomePath(explicit);
  const cwd = process.cwd();
  const candidates = [path.join(cwd, 'backend', 'src', 'agent', 'build'), path.join(cwd, 'src', 'agent', 'build')];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return path.join(__dirname, '..', 'agent', 'build');
};

export const resolveBackendWorkDirRoot = (buildRoot: string): string => {
  // Route backend-owned runtime data under one operator-configurable root so HOOKCODE_WORK_DIR becomes the single storage switch. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const raw = trimString(process.env.HOOKCODE_WORK_DIR) || DEFAULT_WORK_DIR;
  const expanded = expandHomePath(raw);
  if (path.isAbsolute(expanded)) return expanded;
  return path.join(buildRoot, expanded);
};

export const resolveWorkDirOverridePath = (workDirRoot: string, value: unknown): string | null => {
  // Interpret relative override paths beneath HOOKCODE_WORK_DIR so runtime data paths stop depending on process.cwd(). docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const raw = trimString(value);
  if (!raw) return null;
  const expanded = expandHomePath(raw);
  if (path.isAbsolute(expanded)) return expanded;
  return path.join(workDirRoot, expanded);
};

export const buildWorkDirSubpath = (workDirRoot: string, ...segments: string[]): string => {
  // Build canonical HookCode storage subpaths from the shared work root so task-groups, auth secrets, and worker caches stay colocated. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  return path.join(workDirRoot, ...segments);
};

export const resolveTaskGroupWorkspaceRoot = (buildRoot: string): string => {
  // Keep task-group workspaces inside the shared work root so backend and worker subdirectories stay colocated. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  return buildWorkDirSubpath(resolveBackendWorkDirRoot(buildRoot), 'task-groups');
};

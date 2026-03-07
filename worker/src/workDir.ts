import { homedir } from 'os';
import path from 'path';

const DEFAULT_WORK_DIR = '~/.hookcode';

const expandHomePath = (value: string): string => {
  if (value === '~') return homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) return path.join(homedir(), value.slice(2));
  return value;
};

export const resolveWorkerWorkDirRoot = (cwd: string, rawValue: string): string => {
  // Keep worker runtime caches and sticky workspaces under one root so operators only manage HOOKCODE_WORK_DIR. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  const expanded = expandHomePath(rawValue.trim() || DEFAULT_WORK_DIR);
  if (path.isAbsolute(expanded)) return expanded;
  return path.resolve(cwd, expanded);
};

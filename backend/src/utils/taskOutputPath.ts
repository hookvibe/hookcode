import os from 'os';
import path from 'path';

// Resolve a stable, repo-external root for provider output artifacts. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
const DEFAULT_TASK_OUTPUT_ROOT = path.join(os.homedir(), '.hookcode', 'task-outputs');

const isSubPath = (candidate: string, base: string): boolean => {
  // Detect when a configured output root still points inside the repo checkout. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

// Resolve the task output root with env override + repo-safety fallback. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
export const resolveTaskOutputRoot = (params?: { repoDir?: string }) => {
  const rawEnv = String(process.env.HOOKCODE_TASK_OUTPUT_DIR ?? '').trim();
  const resolved = rawEnv ? path.resolve(rawEnv) : DEFAULT_TASK_OUTPUT_ROOT;
  if (params?.repoDir) {
    const repoRoot = path.resolve(params.repoDir);
    if (isSubPath(resolved, repoRoot)) {
      return { root: DEFAULT_TASK_OUTPUT_ROOT, source: 'repo-conflict' as const, envValue: rawEnv || undefined };
    }
  }
  return { root: resolved, source: rawEnv ? ('env' as const) : ('default' as const), envValue: rawEnv || undefined };
};

// Build a task-scoped output file path for provider last-message artifacts. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
export const buildTaskOutputFilePath = (params: { taskId: string; fileName: string; repoDir?: string }) => {
  const taskId = String(params.taskId ?? '').trim();
  if (!taskId) {
    throw new Error('taskId is required to build output file path');
  }
  const fileName = String(params.fileName ?? '').trim();
  if (!fileName) {
    throw new Error('fileName is required to build output file path');
  }
  const selection = resolveTaskOutputRoot({ repoDir: params.repoDir });
  const dir = path.join(selection.root, taskId);
  return { dir, filePath: path.join(dir, fileName), selection };
};

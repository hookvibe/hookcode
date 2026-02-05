import path from 'path';

const normalizeTaskGroupDir = (taskGroupDir: string): string => {
  // Normalize task-group roots so provider outputs always land in the task-group workspace. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
  const trimmed = String(taskGroupDir ?? '').trim();
  if (!trimmed) {
    throw new Error('taskGroupDir is required to build output file path');
  }
  return path.resolve(trimmed);
};

// Build a task-group output file path for provider last-message artifacts. docs/en/developer/plans/codexoutputdir20260124/task_plan.md codexoutputdir20260124
export const buildTaskOutputFilePath = (params: { taskGroupDir: string; fileName: string }) => {
  const fileName = String(params.fileName ?? '').trim();
  if (!fileName) {
    throw new Error('fileName is required to build output file path');
  }
  const dir = normalizeTaskGroupDir(params.taskGroupDir);
  return { dir, filePath: path.join(dir, fileName) };
};

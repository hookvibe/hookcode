const TASK_GROUP_PAT_PREFIX = 'task-group-';
const TASK_GROUP_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Add task-group PAT name parsing for repo/panel filtering. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
export const extractTaskGroupIdFromTokenName = (name: string): string | null => {
  const normalized = typeof name === 'string' ? name.trim() : '';
  if (!normalized.startsWith(TASK_GROUP_PAT_PREFIX)) return null;
  const candidate = normalized.slice(TASK_GROUP_PAT_PREFIX.length).trim();
  if (!TASK_GROUP_ID_REGEX.test(candidate)) return null;
  return candidate;
};

// Provide a boolean helper for task-group generated PAT detection. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
export const isTaskGroupGeneratedTokenName = (name: string): boolean => Boolean(extractTaskGroupIdFromTokenName(name));

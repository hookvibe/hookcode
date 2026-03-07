// Centralize task stop/reorder control constants for the queued workspace refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
export const TASK_MANUAL_STOP_MESSAGE = 'Task stopped manually.';
export const TASK_MANUAL_STOP_REASON = 'manual_stop' as const;

// Keep queue action names stable across controllers, services, and tests. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
export const TASK_REORDER_ACTIONS = ['move_earlier', 'move_later', 'insert_next'] as const;
export type TaskReorderAction = (typeof TASK_REORDER_ACTIONS)[number];

// Re-export API modules from a single barrel for compatibility. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export { API_BASE_URL, api } from './api/client';
export * from './api/types';
export * from './api/taskGroups';
export * from './api/tasks';
export * from './api/auth';
export * from './api/credentials';
export * from './api/system';
export * from './api/repos';
export * from './api/skills'; // Expose skills API helpers for the Skills page. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export * from './api/logs'; // Expose system log API helpers for admin log UI. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export * from './api/notifications'; // Expose notification API helpers for user alerts. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export * from './api/workers'; // Expose worker registry API helpers for admin panels and executor selectors. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307

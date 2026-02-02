// Re-export API modules from a single barrel for compatibility. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export { API_BASE_URL, api } from './api/client';
export * from './api/types';
export * from './api/taskGroups';
export * from './api/tasks';
export * from './api/auth';
export * from './api/credentials';
export * from './api/system';
export * from './api/repos';

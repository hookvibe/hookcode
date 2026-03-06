import { api, getCached, invalidateTaskCaches } from './client';
import type { ArchiveScope, DashboardSidebarSnapshot, Task, TaskLogsPage, TaskStatus, TaskStatusStats, TaskVolumePoint } from './types';

// Split task list/stat/actions APIs into a dedicated module for clearer ownership. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const fetchTasks = async (options?: {
  limit?: number;
  cursor?: string;
  repoId?: string;
  robotId?: string;
  status?: TaskStatus | 'success';
  eventType?: string;
  archived?: ArchiveScope;
  // Allow dashboards to skip queue diagnosis to reduce payload cost. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  includeQueue?: boolean;
}): Promise<{ tasks: Task[]; nextCursor?: string }> => {
  // Fetch task lists with cursor pagination metadata when provided. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  return getCached<{ tasks: Task[]; nextCursor?: string }>('/tasks', { params: options });
};

export const fetchTaskStats = async (options?: {
  repoId?: string;
  robotId?: string;
  eventType?: string;
  archived?: ArchiveScope;
}): Promise<TaskStatusStats> => {
  const data = await getCached<{ stats: TaskStatusStats }>('/tasks/stats', {
    params: options,
    cacheTtlMs: 5000
  });
  return data.stats;
};

export const fetchTaskVolumeByDay = async (options: {
  repoId: string;
  startDay: string;
  endDay: string;
  robotId?: string;
  eventType?: string;
  archived?: ArchiveScope;
}): Promise<TaskVolumePoint[]> => {
  // Fetch per-day task volume for the repo dashboard trend chart (UTC buckets). dashtrendline20260119m9v2
  const data = await getCached<{ points: TaskVolumePoint[] }>('/tasks/volume', {
    params: options,
    cacheTtlMs: 30000
  });
  return data.points;
};

export const fetchDashboardSidebar = async (options?: {
  tasksLimit?: number;
  taskGroupsLimit?: number;
  repoId?: string;
  robotId?: string;
  eventType?: string;
}): Promise<DashboardSidebarSnapshot> => {
  // Reduce redundant sidebar polling calls by fetching a consistent snapshot in one request. 7bqwou6abx4ste96ikhv
  return getCached<DashboardSidebarSnapshot>('/dashboard/sidebar', { params: options, cacheTtlMs: 3000 });
};

export const fetchTask = async (taskId: string): Promise<Task> => {
  const data = await getCached<{ task: Task }>(`/tasks/${taskId}`);
  return data.task;
};

export const retryTask = async (taskId: string, options?: { force?: boolean }): Promise<Task> => {
  const params = options?.force ? { force: 'true' } : undefined;
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/retry`, null, { params });
  invalidateTaskCaches();
  return data.task;
};

export const stopTask = async (taskId: string): Promise<Task> => {
  // Stop queued or running tasks without preserving a resumable paused state. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/stop`);
  invalidateTaskCaches();
  return data.task;
};

export const updateQueuedTaskContent = async (taskId: string, text: string): Promise<Task> => {
  // Edit queued manual task text before the worker starts execution. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const { data } = await api.patch<{ task: Task }>(`/tasks/${taskId}/content`, { text });
  invalidateTaskCaches();
  return data.task;
};

export const reorderQueuedTask = async (
  taskId: string,
  action: 'move_earlier' | 'move_later' | 'insert_next'
): Promise<Task> => {
  // Reorder queued task-group work items using the backend's explicit sequence field. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/reorder`, { action });
  invalidateTaskCaches();
  return data.task;
};

export const executeTaskNow = async (taskId: string): Promise<Task> => {
  // Override time-window gating for queued tasks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/execute-now`);
  invalidateTaskCaches();
  return data.task;
};

export const pushTaskGitChanges = async (taskId: string): Promise<Task> => {
  // Trigger a git push for forked task changes and return the updated task. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  const { data } = await api.post<{ task: Task }>(`/tasks/${taskId}/git/push`);
  invalidateTaskCaches();
  return data.task;
};

export const deleteTask = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}`);
  invalidateTaskCaches();
};

export const fetchTaskLogsPage = async (
  taskId: string,
  options?: { limit?: number; before?: number }
): Promise<TaskLogsPage> => {
  // Fetch paged task logs for the log viewer's "load earlier" flow. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  return getCached<TaskLogsPage>(`/tasks/${taskId}/logs`, { params: options, cacheTtlMs: 0 });
};

export const clearTaskLogs = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}/logs`);
  invalidateTaskCaches();
};

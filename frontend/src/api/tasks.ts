import { api, getCached, invalidateTaskCaches } from './client';
import type { ArchiveScope, DashboardSidebarSnapshot, Task, TaskStatus, TaskStatusStats, TaskVolumePoint } from './types';

// Split task list/stat/actions APIs into a dedicated module for clearer ownership. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const fetchTasks = async (options?: {
  limit?: number;
  repoId?: string;
  robotId?: string;
  status?: TaskStatus | 'success';
  eventType?: string;
  archived?: ArchiveScope;
  // Allow dashboards to skip queue diagnosis to reduce payload cost. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  includeQueue?: boolean;
}): Promise<Task[]> => {
  const data = await getCached<{ tasks: Task[] }>('/tasks', { params: options });
  return data.tasks;
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

export const clearTaskLogs = async (taskId: string): Promise<void> => {
  await api.delete(`/tasks/${taskId}/logs`);
  invalidateTaskCaches();
};

import { api, getCached, invalidateTaskCaches } from './client';
import type {
  ArchiveScope,
  DependencyResult,
  PreviewHighlightCommand,
  PreviewInstanceSummary,
  PreviewStatusResponse,
  RepoPreviewConfigResponse,
  Task,
  TaskGroup,
  TaskGroupKind,
  TimeWindow
} from './types';

// Split task-group and preview APIs into a dedicated module to reduce merge conflicts. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const fetchTaskGroups = async (options?: {
  limit?: number;
  repoId?: string;
  robotId?: string;
  kind?: TaskGroupKind;
  archived?: ArchiveScope;
}): Promise<TaskGroup[]> => {
  const data = await getCached<{ taskGroups: TaskGroup[] }>('/task-groups', {
    params: options,
    cacheTtlMs: 5000
  });
  return data.taskGroups;
};

export const fetchTaskGroup = async (id: string): Promise<TaskGroup> => {
  const data = await getCached<{ taskGroup: TaskGroup }>(`/task-groups/${id}`);
  return data.taskGroup;
};

export const fetchTaskGroupTasks = async (id: string, options?: { limit?: number }): Promise<Task[]> => {
  const data = await getCached<{ tasks: Task[] }>(`/task-groups/${id}/tasks`, { params: options });
  return data.tasks;
};

// Preview API helpers for TaskGroup dev server lifecycle. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const fetchTaskGroupPreviewStatus = async (id: string): Promise<PreviewStatusResponse> => {
  const { data } = await api.get<PreviewStatusResponse>(`/task-groups/${id}/preview/status`);
  return data;
};

export const startTaskGroupPreview = async (id: string): Promise<{ success: boolean; instances: PreviewInstanceSummary[] }> => {
  const { data } = await api.post<{ success: boolean; instances: PreviewInstanceSummary[] }>(`/task-groups/${id}/preview/start`);
  return data;
};

export const stopTaskGroupPreview = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await api.post<{ success: boolean }>(`/task-groups/${id}/preview/stop`);
  return data;
};

// Send highlight commands to the preview iframe bridge via the backend API. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const sendTaskGroupPreviewHighlight = async (
  id: string,
  instanceName: string,
  command: PreviewHighlightCommand
): Promise<{ success: boolean; requestId: string; subscribers: number }> => {
  const { data } = await api.post<{ success: boolean; requestId: string; subscribers: number }>(
    `/task-groups/${id}/preview/${instanceName}/highlight`,
    command
  );
  return data;
};

// Trigger manual dependency installs for TaskGroup previews. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const installTaskGroupPreviewDependencies = async (
  id: string
): Promise<{ success: boolean; result: DependencyResult }> => {
  const { data } = await api.post<{ success: boolean; result: DependencyResult }>(
    `/task-groups/${id}/preview/dependencies/install`
  );
  return data;
};

// Fetch repository preview config availability for repo detail UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export const fetchRepoPreviewConfig = async (id: string): Promise<RepoPreviewConfigResponse> => {
  const { data } = await api.get<RepoPreviewConfigResponse>(`/repos/${id}/preview/config`);
  return data;
};

export const executeChat = async (params: {
  repoId: string;
  robotId: string;
  text: string;
  taskGroupId?: string;
  timeWindow?: TimeWindow | null;
}): Promise<{ taskGroup: TaskGroup; task: Task }> => {
  // Business context:
  // - Manual trigger without Webhooks (frontend Chat page + chat embeds under task/taskGroup pages).
  // - Change record: added to call backend `/chat` endpoint.
  const { data } = await api.post<{ taskGroup: TaskGroup; task: Task }>('/chat', params);
  invalidateTaskCaches();
  return data;
};

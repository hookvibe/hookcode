import { api, getCached, invalidateGetCache } from './client';
import type { ListWorkersResponse, WorkerBindInfo, WorkerRecord } from './types';

// Centralize worker registry mutations so every admin surface invalidates the same worker cache keys. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
const invalidateWorkerCaches = () => {
  invalidateGetCache('/workers');
};

export const fetchWorkersRegistry = async (): Promise<ListWorkersResponse> => {
  const data = await getCached<ListWorkersResponse>('/workers', { cacheTtlMs: 5000 });
  return {
    workers: Array.isArray(data.workers) ? data.workers : [],
    versionRequirement: data.versionRequirement,
    defaultBackendUrl: typeof data.defaultBackendUrl === 'string' ? data.defaultBackendUrl : ''
  };
};

export const fetchWorkers = async (): Promise<WorkerRecord[]> => {
  const data = await fetchWorkersRegistry();
  return data.workers;
};

export const createWorker = async (params: { name: string; maxConcurrency?: number; backendUrl: string }): Promise<WorkerBindInfo> => {
  const { data } = await api.post<WorkerBindInfo>('/workers', params);
  invalidateWorkerCaches();
  return data;
};

export const updateWorker = async (
  id: string,
  params: Partial<{ name: string; status: 'online' | 'offline' | 'disabled'; maxConcurrency: number; isGlobalDefault: boolean }>
): Promise<{ worker: WorkerRecord }> => {
  const { data } = await api.patch<{ worker: WorkerRecord }>(`/workers/${id}`, params);
  invalidateWorkerCaches();
  return data;
};

export const resetWorkerBindCode = async (id: string, backendUrl?: string): Promise<WorkerBindInfo> => {
  const payload = typeof backendUrl === 'string' && backendUrl.trim() ? { backendUrl: backendUrl.trim() } : undefined;
  const { data } = await api.post<WorkerBindInfo>(`/workers/${id}/reset-bind-code`, payload);
  invalidateWorkerCaches();
  return data;
};

export const prepareWorkerRuntime = async (id: string, providers?: string[]): Promise<{ success: boolean }> => {
  const { data } = await api.post<{ success: boolean }>(`/workers/${id}/prepare-runtime`, { providers });
  invalidateWorkerCaches();
  return data;
};

export const deleteWorker = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await api.delete<{ success: boolean }>(`/workers/${id}`);
  invalidateWorkerCaches();
  return data;
};

import { api, getCached, invalidateGetCache } from './client';
import type { ListWorkersResponse, WorkerBootstrapInfo, WorkerRecord } from './types';

// Centralize worker registry mutations so every admin surface invalidates the same worker cache keys. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
const invalidateWorkerCaches = () => {
  invalidateGetCache('/workers');
};

export const fetchWorkers = async (): Promise<WorkerRecord[]> => {
  const data = await getCached<ListWorkersResponse>('/workers', { cacheTtlMs: 5000 });
  return Array.isArray(data.workers) ? data.workers : [];
};

export const createWorker = async (params: { name: string; maxConcurrency?: number }): Promise<WorkerBootstrapInfo> => {
  const { data } = await api.post<WorkerBootstrapInfo>('/workers', params);
  invalidateWorkerCaches();
  return data;
};

export const updateWorker = async (
  id: string,
  params: Partial<{ name: string; status: 'online' | 'offline' | 'disabled'; maxConcurrency: number }>
): Promise<{ worker: WorkerRecord }> => {
  const { data } = await api.patch<{ worker: WorkerRecord }>(`/workers/${id}`, params);
  invalidateWorkerCaches();
  return data;
};

export const rotateWorkerToken = async (id: string): Promise<WorkerBootstrapInfo> => {
  const { data } = await api.post<WorkerBootstrapInfo>(`/workers/${id}/rotate-token`);
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

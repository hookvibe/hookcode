import { api, getCached, invalidateGetCache } from './client';
import type { ListWorkersResponse, WorkerApiKeyInfo, WorkerRecord } from './types';

const invalidateWorkerCaches = () => {
  invalidateGetCache('/workers');
};

export const fetchWorkersRegistry = async (): Promise<ListWorkersResponse> => {
  const data = await getCached<ListWorkersResponse>('/workers', { cacheTtlMs: 5000 });
  return {
    workers: Array.isArray(data.workers) ? data.workers : [],
    defaultBackendUrl: typeof data.defaultBackendUrl === 'string' ? data.defaultBackendUrl : ''
  };
};

export const fetchWorkers = async (): Promise<WorkerRecord[]> => {
  const data = await fetchWorkersRegistry();
  return data.workers;
};

export const createWorker = async (params: { name: string; maxConcurrency?: number; providers?: string[] }): Promise<WorkerApiKeyInfo> => {
  const { data } = await api.post<WorkerApiKeyInfo>('/workers', params);
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

export const rotateWorkerApiKey = async (id: string): Promise<WorkerApiKeyInfo> => {
  const { data } = await api.post<WorkerApiKeyInfo>(`/workers/${id}/rotate-api-key`);
  invalidateWorkerCaches();
  return data;
};

export const deleteWorker = async (id: string): Promise<{ success: boolean }> => {
  const { data } = await api.delete<{ success: boolean }>(`/workers/${id}`);
  invalidateWorkerCaches();
  return data;
};

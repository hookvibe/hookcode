// Keep worker labels, runtime states, and tag colors consistent across worker-aware UI surfaces. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307

import type { WorkerRecord, WorkerSummary } from '../api';
import type { TFunction } from '../i18n';

export const getWorkerStatusColor = (status: WorkerSummary['status']): string => {
  if (status === 'online') return 'green';
  if (status === 'offline') return 'orange';
  return 'default';
};

export const getWorkerKindLabel = (t: TFunction, kind: WorkerSummary['kind']): string =>
  t(kind === 'local' ? 'workers.kind.local' : 'workers.kind.remote');

export const getWorkerStatusLabel = (t: TFunction, status: WorkerSummary['status']): string =>
  t(`workers.status.${status}` as any);

export const formatWorkerOptionLabel = (t: TFunction, worker: WorkerSummary | WorkerRecord): string => {
  // Keep worker selector labels consistent across settings, repo robots, and chat routing. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  return `${worker.name} · ${getWorkerKindLabel(t, worker.kind)} · ${getWorkerStatusLabel(t, worker.status)}`;
};

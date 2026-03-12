// Group worker registry API types into a focused module so admin panels and selectors share one contract. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307

export type WorkerKind = 'local' | 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';

export interface WorkerRuntimeCapability {
  language: string;
  version?: string;
  path?: string;
}

export interface WorkerCapabilities {
  preview?: boolean;
  runtimes?: WorkerRuntimeCapability[];
  providers?: string[];
}

export interface WorkerRuntimeState {
  preparedProviders?: string[];
  preparingProviders?: string[];
  lastPrepareAt?: string;
  lastPrepareError?: string;
}

export interface WorkerSummary {
  id: string;
  name: string;
  kind: WorkerKind;
  status: WorkerStatus;
  preview?: boolean;
}

export interface WorkerRecord extends WorkerSummary {
  // Keep worker records focused on connection and runtime details so the UI matches the simplified worker model. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
  version?: string;
  platform?: string;
  arch?: string;
  hostname?: string;
  backendBaseUrl?: string;
  capabilities?: WorkerCapabilities;
  runtimeState?: WorkerRuntimeState;
  maxConcurrency: number;
  currentConcurrency: number;
  lastSeenAt?: string;
  lastHelloAt?: string;
  disabledAt?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerBootstrapInfo {
  worker: WorkerRecord;
  workerId: string;
  token: string;
  backendUrl: string;
  wsUrl: string;
}

export interface ListWorkersResponse {
  workers: WorkerRecord[];
}

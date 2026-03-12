export type WorkerKind = 'local' | 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';

export interface WorkerCapabilities {
  // Limit preview support to local workers in v1 so remote dev-server proxying stays explicit. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  preview?: boolean;
  runtimes?: Array<{ language: string; version?: string; path?: string }>;
  providers?: string[];
}

export interface WorkerRuntimeState {
  // Persist provider/runtime preparation state for the admin worker panel. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
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
  // Keep worker API records focused on connection/runtime state instead of legacy backend-managed classification. docs/en/developer/plans/external-worker-bind-existing-20260312/task_plan.md external-worker-bind-existing-20260312
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
  workerId: string;
  token: string;
  backendUrl: string;
  wsUrl: string;
}

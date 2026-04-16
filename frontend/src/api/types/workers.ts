// Group worker registry API types into a focused module so admin panels and selectors share one contract. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307

export type WorkerKind = 'local' | 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';
export type WorkerVersionStatus = 'compatible' | 'mismatch' | 'unknown';
export type WorkerProviderKey = 'codex' | 'claude_code' | 'gemini_cli';
export type WorkerProviderRuntimeStatus = 'idle' | 'preparing' | 'ready' | 'error';

export interface WorkerProviderRuntimeEntry {
  status: WorkerProviderRuntimeStatus;
  startedAt?: string;
  finishedAt?: string;
  error?: string;
}

export type WorkerProviderRuntimeStatuses = Partial<Record<WorkerProviderKey, WorkerProviderRuntimeEntry>>;

export interface WorkerRuntimeCapability {
  language: string;
  version?: string;
  path?: string;
}

export interface WorkerCapabilities {
  preview?: boolean;
  runtimes?: WorkerRuntimeCapability[];
  providers?: WorkerProviderKey[];
}

export interface WorkerRuntimeState {
  // Mirror provider-level runtime readiness so chat and worker settings can render Codex/Claude/Gemini availability consistently. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
  providerStatuses?: WorkerProviderRuntimeStatuses;
  preparedProviders?: WorkerProviderKey[];
  preparingProviders?: WorkerProviderKey[];
  lastPrepareAt?: string;
  lastPrepareError?: string;
}

export interface WorkerVersionRequirement {
  packageName: string;
  requiredVersion: string;
  npmInstallCommand: string;
  cliUpgradeCommand: string;
  dockerImage: string;
  dockerPullCommand: string;
}

export interface WorkerVersionState {
  currentVersion?: string;
  status: WorkerVersionStatus;
  upgradeRequired: boolean;
}

export interface WorkerSummary {
  id: string;
  name: string;
  kind: WorkerKind;
  status: WorkerStatus;
  isGlobalDefault: boolean;
  preview?: boolean;
}

export interface WorkerRecord extends WorkerSummary {
  systemManaged: boolean;
  version?: string;
  versionState?: WorkerVersionState;
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

export interface WorkerBindInfo {
  worker: WorkerRecord;
  bindCode: string;
  bindCodeExpiresAt: string;
  backendUrl: string;
  versionRequirement: WorkerVersionRequirement;
}

export interface ListWorkersResponse {
  workers: WorkerRecord[];
  versionRequirement: WorkerVersionRequirement;
  defaultBackendUrl: string;
}

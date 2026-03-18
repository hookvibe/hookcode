export type WorkerKind = 'local' | 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';
export type WorkerVersionStatus = 'compatible' | 'mismatch' | 'unknown';

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
  preview?: boolean;
}

export interface WorkerRecord extends WorkerSummary {
  systemManaged: boolean;
  version?: string;
  versionState: WorkerVersionState;
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
  versionRequirement: WorkerVersionRequirement;
}

export interface WorkerRegistrationResult {
  workerId: string;
  workerToken: string;
  backendUrl: string;
}

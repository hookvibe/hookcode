export type WorkerKind = 'local' | 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';
export type WorkerVersionStatus = 'compatible' | 'mismatch' | 'unknown';
export type WorkerProviderKey = 'codex' | 'claude_code' | 'gemini_cli';
export type WorkerProviderRuntimeStatus = 'idle' | 'ready' | 'error';

export interface WorkerProviderRuntimeEntry {
  status: WorkerProviderRuntimeStatus;
  checkedAt?: string;
  command?: string;
  path?: string;
  version?: string;
  error?: string;
}

export type WorkerProviderRuntimeStatuses = Partial<Record<WorkerProviderKey, WorkerProviderRuntimeEntry>>;

export interface WorkerCapabilities {
  // Limit preview support to local workers in v1 so remote dev-server proxying stays explicit. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  preview?: boolean;
  runtimes?: Array<{ language: string; version?: string; path?: string }>;
  providers?: WorkerProviderKey[];
}

export interface WorkerRuntimeState {
  // Persist provider-level environment availability so task creation can stop before dispatch when the selected worker lacks a global Codex/Claude/Gemini CLI. docs/en/developer/plans/7i9tp61el8rrb4r7j5xj/task_plan.md 7i9tp61el8rrb4r7j5xj
  providerStatuses?: WorkerProviderRuntimeStatuses;
  availableProviders?: WorkerProviderKey[];
  lastCheckedAt?: string;
  lastCheckError?: string;
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
  backendUrl: string;
  versionRequirement: WorkerVersionRequirement;
}

export interface WorkerRegistrationResult {
  workerId: string;
  workerToken: string;
  backendUrl: string;
}

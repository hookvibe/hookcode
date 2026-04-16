// Group worker registry API types into a focused module so admin panels and selectors share one contract.

export type WorkerKind = 'local' | 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';
export type WorkerProviderKey = 'codex' | 'claude_code' | 'gemini_cli';

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
  platform?: string;
  arch?: string;
  hostname?: string;
  capabilities?: WorkerCapabilities;
  providers: WorkerProviderKey[];
  maxConcurrency: number;
  activeTaskCount: number;
  apiKeyPrefix?: string;
  lastHeartbeatAt?: string;
  disabledAt?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerApiKeyInfo {
  worker: WorkerRecord;
  apiKey: string;
}

export interface ListWorkersResponse {
  workers: WorkerRecord[];
  defaultBackendUrl: string;
}

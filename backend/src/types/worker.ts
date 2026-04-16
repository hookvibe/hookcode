export type WorkerKind = 'remote';
export type WorkerStatus = 'online' | 'offline' | 'disabled';
export type WorkerProviderKey = 'codex' | 'claude_code' | 'gemini_cli';

export interface WorkerCapabilities {
  preview?: boolean;
  runtimes?: Array<{ language: string; version?: string; path?: string }>;
}

export interface WorkerSummary {
  id: string;
  name: string;
  kind: WorkerKind;
  status: WorkerStatus;
  isGlobalDefault: boolean;
  preview?: boolean;
  providers: WorkerProviderKey[];
}

export interface WorkerRecord extends WorkerSummary {
  version?: string;
  platform?: string;
  arch?: string;
  hostname?: string;
  capabilities?: WorkerCapabilities;
  maxConcurrency: number;
  activeTaskCount: number;
  lastHeartbeatAt?: string;
  disabledAt?: string;
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkerApiKeyInfo {
  worker: WorkerRecord;
  /** Full API key — only shown once at creation time */
  apiKey: string;
}

export interface WorkerRegistrationResult {
  workerId: string;
  apiKey: string;
}

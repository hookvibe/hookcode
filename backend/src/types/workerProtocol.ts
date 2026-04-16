import type { WorkerCapabilities, WorkerRuntimeState } from './worker';

export type WorkerHelloMessage = {
  type: 'hello';
  version?: string;
  platform?: string;
  arch?: string;
  hostname?: string;
  capabilities?: WorkerCapabilities;
  runtimeState?: WorkerRuntimeState;
  maxConcurrency?: number;
  activeTaskIds?: string[];
};

export type WorkerHeartbeatMessage = {
  type: 'heartbeat';
  runtimeState?: WorkerRuntimeState;
  activeTaskIds?: string[];
};

export type WorkerTaskAcceptedMessage = {
  type: 'taskAccepted';
  taskId: string;
};

export type WorkerRuntimePrepareStartedMessage = {
  type: 'runtimePrepareStarted';
  providers?: Array<'codex' | 'claude_code' | 'gemini_cli'>;
  runtimeState?: WorkerRuntimeState;
};

export type WorkerRuntimePrepareFinishedMessage = {
  type: 'runtimePrepareFinished';
  providers?: Array<'codex' | 'claude_code' | 'gemini_cli'>;
  runtimeState?: WorkerRuntimeState;
  error?: string;
};

export type WorkerWorkspaceResponseMessage = {
  type: 'workspaceResponse';
  requestId: string;
  taskId: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
};

export type WorkerInboundMessage =
  | WorkerHelloMessage
  | WorkerHeartbeatMessage
  | WorkerTaskAcceptedMessage
  | WorkerRuntimePrepareStartedMessage
  | WorkerRuntimePrepareFinishedMessage
  | WorkerWorkspaceResponseMessage;

export type WorkerAssignTaskMessage = {
  type: 'assignTask';
  taskId: string;
};

export type WorkerPrepareRuntimeMessage = {
  type: 'prepareRuntime';
  providers?: Array<'codex' | 'claude_code' | 'gemini_cli'>;
};

export type WorkerCancelTaskMessage = {
  type: 'cancelTask';
  taskId: string;
};

export type WorkerPingMessage = { type: 'ping' };

export type WorkerWorkspaceRequestMessage = {
  type: 'workspaceRequest';
  requestId: string;
  taskId: string;
  action: 'snapshot' | 'stage' | 'unstage' | 'discard' | 'delete_untracked' | 'commit';
  payload?: {
    paths?: string[];
    message?: string;
  };
};

export type WorkerOutboundMessage =
  | WorkerAssignTaskMessage
  | WorkerPrepareRuntimeMessage
  | WorkerCancelTaskMessage
  | WorkerPingMessage
  | WorkerWorkspaceRequestMessage;

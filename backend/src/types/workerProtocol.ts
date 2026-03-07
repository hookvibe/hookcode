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
  providers?: string[];
};

export type WorkerRuntimePrepareFinishedMessage = {
  type: 'runtimePrepareFinished';
  providers?: string[];
  runtimeState?: WorkerRuntimeState;
  error?: string;
};

export type WorkerInboundMessage =
  | WorkerHelloMessage
  | WorkerHeartbeatMessage
  | WorkerTaskAcceptedMessage
  | WorkerRuntimePrepareStartedMessage
  | WorkerRuntimePrepareFinishedMessage;

export type WorkerAssignTaskMessage = {
  type: 'assignTask';
  taskId: string;
};

export type WorkerPrepareRuntimeMessage = {
  type: 'prepareRuntime';
  providers?: string[];
};

export type WorkerCancelTaskMessage = {
  type: 'cancelTask';
  taskId: string;
};

export type WorkerPingMessage = { type: 'ping' };

export type WorkerOutboundMessage =
  | WorkerAssignTaskMessage
  | WorkerPrepareRuntimeMessage
  | WorkerCancelTaskMessage
  | WorkerPingMessage;

/**
 * Worker HTTP Pull Protocol (v2)
 *
 * Replaces WebSocket protocol. Workers authenticate via API key (Bearer token)
 * and poll for tasks via HTTP long-polling.
 */
import type { WorkerCapabilities, WorkerProviderKey } from './worker';

// ── Worker → Backend (HTTP requests) ──

/** POST /api/workers/poll — request body */
export type WorkerPollRequest = {
  providers?: WorkerProviderKey[];
  activeTaskIds?: string[];
  version?: string;
  platform?: string;
  arch?: string;
  hostname?: string;
  capabilities?: WorkerCapabilities;
};

/** POST /api/workers/poll — response body (null if no task available) */
export type WorkerPollResponse = {
  taskId: string;
} | null;

/** POST /api/workers/heartbeat — request body */
export type WorkerHeartbeatRequest = {
  activeTaskIds?: string[];
  version?: string;
  providers?: WorkerProviderKey[];
};

/** POST /api/tasks/:id/accept — request body */
export type WorkerTaskAcceptRequest = {
  // intentionally empty — presence means acceptance
};

/** POST /api/tasks/:id/finalize — request body */
export type WorkerTaskFinalizeRequest = {
  status: 'succeeded' | 'failed';
  message?: string;
  result?: Record<string, unknown>;
  durationMs?: number;
  providerCommentUrl?: string;
  outputText?: string;
  gitStatus?: unknown;
  stopReason?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
};


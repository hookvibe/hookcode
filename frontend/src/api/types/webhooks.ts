// Mirror webhook replay/debug payloads from the backend so repo and admin UIs share one event model. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313

import type { TimeWindow } from './common';
import type { RepoProvider } from './repos';

export type RepoWebhookDeliveryResult = 'accepted' | 'skipped' | 'rejected' | 'error';

export type WebhookErrorLayer =
  | 'repo_lookup'
  | 'repo_state'
  | 'provider_mismatch'
  | 'scope_validation'
  | 'signature_validation'
  | 'name_binding'
  | 'repo_binding'
  | 'robot_resolution'
  | 'event_mapping'
  | 'guard'
  | 'rule_match'
  | 'task_creation'
  | 'dry_run'
  | 'replay'
  | 'internal';

export type WebhookReplayMode = 'stored_actions' | 'current_config' | 'override_robot' | 'override_rule';
export type WebhookTraceStepStatus = 'success' | 'skipped' | 'failed';

export interface WebhookTraceStep {
  key: string;
  title: string;
  status: WebhookTraceStepStatus;
  at: string;
  code?: string;
  message?: string;
  meta?: unknown;
}

export interface WebhookResolvedActionSnapshot {
  ruleId: string;
  robotId: string;
  promptCustom?: string | null;
  timeWindow?: TimeWindow | null;
  source: 'current_config' | 'stored_actions' | 'override_robot' | 'override_rule';
}

export interface WebhookDryRunRobotResult {
  robotId: string;
  ruleId?: string;
  ok: boolean;
  summary: {
    provider: string;
    model: string;
    sandbox: 'read-only' | 'workspace-write';
    networkAccess: boolean;
  };
  warnings: string[];
  modelOutput?: string;
  modelError?: string;
}

export interface WebhookDryRunResult {
  mode: WebhookReplayMode;
  results: WebhookDryRunRobotResult[];
}

export interface WebhookDebugTrace {
  source: 'ingress' | 'replay';
  provider: 'gitlab' | 'github';
  eventName?: string;
  replayOfEventId?: string;
  replayMode?: WebhookReplayMode;
  steps: WebhookTraceStep[];
  resolvedActions?: WebhookResolvedActionSnapshot[];
  taskIds?: string[];
  taskGroupIds?: string[];
  dryRunResult?: WebhookDryRunResult;
}

export interface RepoWebhookDeliverySummary {
  id: string;
  repoId: string;
  provider: RepoProvider;
  eventName?: string;
  mappedEventType?: string;
  deliveryId?: string;
  result: RepoWebhookDeliveryResult;
  httpStatus: number;
  code?: string;
  message?: string;
  payloadHash?: string;
  signatureVerified?: boolean;
  errorLayer?: WebhookErrorLayer;
  matchedRuleIds: string[];
  matchedRobotIds: string[];
  taskIds: string[];
  taskGroupIds: string[];
  replayOfEventId?: string;
  replayMode?: WebhookReplayMode;
  createdAt: string;
}

export interface RepoWebhookDeliveryDetail extends RepoWebhookDeliverySummary {
  payload?: unknown;
  response?: unknown;
  debugTrace?: WebhookDebugTrace;
  dryRunResult?: WebhookDryRunResult;
  replays?: RepoWebhookDeliverySummary[];
}

export type WebhookEventSummary = RepoWebhookDeliverySummary;
export type WebhookEventDetail = RepoWebhookDeliveryDetail;

export interface ReplayWebhookEventRequest {
  mode?: WebhookReplayMode;
  robotId?: string;
  ruleId?: string;
}

export interface ListWebhookEventsParams {
  limit?: number;
  cursor?: string;
  repoId?: string;
  provider?: RepoProvider;
  result?: RepoWebhookDeliveryResult;
  errorLayer?: WebhookErrorLayer;
  replayOfEventId?: string;
  q?: string;
}

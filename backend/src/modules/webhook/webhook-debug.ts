import { createHash } from 'crypto';
import type { TimeWindow } from '../../types/timeWindow';

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

const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, next]) => `${JSON.stringify(key)}:${stableStringify(next)}`).join(',')}}`;
  }
  return JSON.stringify(String(value));
};

// Hash payloads deterministically so replay/debug views can compare events without storing duplicate large JSON blobs. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const hashWebhookPayload = (payload: unknown): string => createHash('sha256').update(stableStringify(payload)).digest('hex');

// Build append-only webhook debug traces so repo/admin UIs can render a timeline without re-executing business logic. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export class WebhookTraceRecorder {
  private readonly trace: WebhookDebugTrace;

  constructor(input: { source: 'ingress' | 'replay'; provider: 'gitlab' | 'github'; eventName?: string; replayOfEventId?: string; replayMode?: WebhookReplayMode }) {
    this.trace = {
      source: input.source,
      provider: input.provider,
      eventName: input.eventName,
      replayOfEventId: input.replayOfEventId,
      replayMode: input.replayMode,
      steps: []
    };
  }

  addStep(step: Omit<WebhookTraceStep, 'at'> & { at?: string }): void {
    this.trace.steps.push({
      ...step,
      at: step.at ?? new Date().toISOString()
    });
  }

  setResolvedActions(actions: WebhookResolvedActionSnapshot[]): void {
    this.trace.resolvedActions = actions.map((action) => ({ ...action }));
  }

  setTaskLinks(taskIds: string[], taskGroupIds: string[]): void {
    this.trace.taskIds = [...taskIds];
    this.trace.taskGroupIds = [...taskGroupIds];
  }

  setDryRunResult(result: WebhookDryRunResult): void {
    this.trace.dryRunResult = {
      mode: result.mode,
      results: result.results.map((item) => ({
        ...item,
        warnings: [...item.warnings]
      }))
    };
  }

  snapshot(): WebhookDebugTrace {
    return {
      ...this.trace,
      steps: this.trace.steps.map((step) => ({ ...step })),
      resolvedActions: this.trace.resolvedActions?.map((action) => ({ ...action })),
      taskIds: this.trace.taskIds ? [...this.trace.taskIds] : undefined,
      taskGroupIds: this.trace.taskGroupIds ? [...this.trace.taskGroupIds] : undefined,
      dryRunResult: this.trace.dryRunResult
        ? {
            mode: this.trace.dryRunResult.mode,
            results: this.trace.dryRunResult.results.map((item) => ({
              ...item,
              warnings: [...item.warnings]
            }))
          }
        : undefined
    };
  }
}

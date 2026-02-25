// Extract shared API types into a common module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export type ArchiveScope = 'active' | 'archived' | 'all'; // Keep archive filtering consistent with backend query params. qnp1mtxhzikhbi0xspbc

export type TaskStatus = 'queued' | 'processing' | 'paused' | 'succeeded' | 'failed' | 'commented'; // Include paused for task stop/resume UX. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
export type TaskQueueReasonCode =
  | 'queue_backlog'
  | 'no_active_worker'
  | 'inline_worker_disabled'
  | 'outside_time_window'
  | 'unknown';

// Shared hour-level time window shape for scheduling inputs. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export interface TimeWindow {
  startHour: number;
  endHour: number;
}

export interface TaskQueueTimeWindow {
  // Provide time window metadata for queued task explanations. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  startHour: number;
  endHour: number;
  source: 'robot' | 'trigger' | 'chat';
  timezone: 'server';
}

export interface TaskQueueDiagnosis {
  // Surface queued-task diagnosis so the UI can explain long-waiting tasks. f3a9c2d8e1b7f4a0c6d1
  reasonCode: TaskQueueReasonCode;
  ahead: number;
  queuedTotal: number;
  processing: number;
  staleProcessing: number;
  inlineWorkerEnabled: boolean;
  timeWindow?: TaskQueueTimeWindow;
}

export interface DependencyInstallStep {
  // Dependency install steps returned by task APIs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  command?: string;
  workdir?: string;
  status: 'success' | 'skipped' | 'failed';
  duration?: number;
  error?: string;
  reason?: string;
}

export interface DependencyResult {
  status: 'success' | 'partial' | 'skipped' | 'failed';
  steps: DependencyInstallStep[];
  totalDuration: number;
}

export interface RuntimeInfo {
  // Runtime metadata returned by `/api/system/runtimes`. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  language: 'node' | 'python' | 'java' | 'ruby' | 'go';
  version: string;
  path: string;
  packageManager?: string;
}

export interface SystemRuntimesResponse {
  runtimes: RuntimeInfo[];
  detectedAt?: string;
}

export type TaskEventType =
  | 'issue'
  | 'commit'
  | 'merge_request'
  | 'issue_created'
  | 'issue_comment'
  | 'commit_review'
  | 'push'
  | 'note'
  | 'unknown'
  | (string & {});

export interface AdminToolsMeta {
  enabled: boolean;
  ports: {
    prisma: number;
    swagger: number;
  };
}

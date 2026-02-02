// Shared preview types for TaskGroup dev server orchestration. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export type PreviewInstanceStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

// Provide preview diagnostics for failed/timeout instances. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewDiagnostics {
  exitCode?: number | null;
  signal?: string | null;
  logs?: PreviewLogEntry[];
}

export interface PreviewInstanceSummary {
  name: string;
  status: PreviewInstanceStatus;
  port?: number;
  path?: string;
  // Surface preview public URLs for subdomain routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  publicUrl?: string;
  message?: string;
  diagnostics?: PreviewDiagnostics;
}

export interface PreviewStatusSnapshot {
  available: boolean;
  instances: PreviewInstanceSummary[];
  reason?: 'config_missing' | 'config_invalid' | 'workspace_missing' | 'invalid_group' | 'missing_task';
}

// Capture structured preview log entries for SSE clients. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewLogEntry {
  timestamp: string;
  level: 'stdout' | 'stderr' | 'system';
  message: string;
}

// Describe highlight commands sent to preview bridge scripts. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export type PreviewHighlightMode = 'outline' | 'mask';

// Describe optional bubble tooltip settings for preview highlights. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
export type PreviewHighlightBubblePlacement = 'top' | 'right' | 'bottom' | 'left' | 'auto';
export type PreviewHighlightBubbleAlign = 'start' | 'center' | 'end';
export type PreviewHighlightBubbleTheme = 'dark' | 'light';

export interface PreviewHighlightBubble {
  text: string;
  placement?: PreviewHighlightBubblePlacement;
  align?: PreviewHighlightBubbleAlign;
  offset?: number;
  maxWidth?: number;
  theme?: PreviewHighlightBubbleTheme;
  background?: string;
  textColor?: string;
  borderColor?: string;
  radius?: number;
  arrow?: boolean;
}

export interface PreviewHighlightCommand {
  selector: string;
  padding?: number;
  color?: string;
  mode?: PreviewHighlightMode;
  scrollIntoView?: boolean;
  // Forward optional bubble tooltip payload to the preview bridge. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  bubble?: PreviewHighlightBubble;
  requestId?: string;
}

// Publish preview highlight events over SSE for the frontend bridge. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewHighlightEvent {
  taskGroupId: string;
  instanceName: string;
  command: PreviewHighlightCommand;
  issuedAt: string;
}

// Describe per-instance preview config for repo-level discovery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface RepoPreviewInstanceSummary {
  name: string;
  workdir: string;
}

// Surface repo-level preview configuration availability in the repo detail API. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface RepoPreviewConfigSnapshot {
  available: boolean;
  instances: RepoPreviewInstanceSummary[];
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';
}

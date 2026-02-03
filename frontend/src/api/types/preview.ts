// Isolate preview-related API types for task group dev preview features. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

// Define preview API response types for TaskGroup dev server status. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export type PreviewInstanceStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

// Surface preview diagnostics and log payloads for Phase 3 UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewLogEntry {
  timestamp: string;
  level: 'stdout' | 'stderr' | 'system';
  message: string;
}

// Attach diagnostics to preview status payloads for failed/timeout sessions. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface PreviewDiagnostics {
  exitCode?: number | null;
  signal?: string | null;
  errors?: string[];
  logs?: PreviewLogEntry[];
}

export interface PreviewInstanceSummary {
  instanceId: string;
  status: PreviewInstanceStatus;
  updatedAt: string;
}

export interface PreviewStatusResponse {
  status: PreviewInstanceStatus;
  logs?: PreviewLogEntry[];
  diagnostics?: PreviewDiagnostics;
}

export type PreviewHighlightMode = 'outline' | 'mask';
export type PreviewHighlightBubblePlacement = 'top' | 'right' | 'bottom' | 'left' | 'auto';
export type PreviewHighlightBubbleAlign = 'start' | 'center' | 'end';
export type PreviewHighlightBubbleTheme = 'dark' | 'light';

export interface PreviewHighlightBubble {
  placement?: PreviewHighlightBubblePlacement;
  align?: PreviewHighlightBubbleAlign;
  theme?: PreviewHighlightBubbleTheme;
}

export interface PreviewHighlightCommand {
  selector: string;
  mode?: PreviewHighlightMode;
  bubble?: PreviewHighlightBubble;
  label?: string;
}

export interface PreviewHighlightEvent {
  id: string;
  command?: PreviewHighlightCommand;
  createdAt: string;
}

// Shape repo preview config responses for the repo detail dashboard. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
export interface RepoPreviewInstanceSummary {
  name: string;
  workdir: string;
}

export interface RepoPreviewConfigResponse {
  available: boolean;
  instances: RepoPreviewInstanceSummary[];
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';
}

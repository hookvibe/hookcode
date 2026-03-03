// Keep preview API contracts aligned with backend runtime/admin preview endpoints. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303

export type PreviewInstanceStatus = 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';
// Mirror backend display mode so preview tabs can render iframe or terminal output per instance. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303
export type PreviewInstanceDisplayMode = 'webview' | 'terminal';

// Capture preview log rows used by diagnostics and SSE snapshots. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export interface PreviewLogEntry {
  timestamp: string;
  level: 'stdout' | 'stderr' | 'system';
  message: string;
}

// Expose startup diagnostics for failed or timeout preview instances. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export interface PreviewDiagnostics {
  exitCode?: number | null;
  signal?: string | null;
  logs?: PreviewLogEntry[];
}

export interface PreviewInstanceSummary {
  name: string;
  display: PreviewInstanceDisplayMode;
  status: PreviewInstanceStatus;
  port?: number;
  path?: string;
  publicUrl?: string;
  message?: string;
  diagnostics?: PreviewDiagnostics;
}

export interface PreviewStatusResponse {
  available: boolean;
  instances: PreviewInstanceSummary[];
  reason?: 'config_missing' | 'config_invalid' | 'workspace_missing' | 'invalid_group' | 'missing_task';
}

export type PreviewHighlightMode = 'outline' | 'mask';
export type PreviewHighlightBubblePlacement = 'top' | 'right' | 'bottom' | 'left' | 'auto';
export type PreviewHighlightBubbleAlign = 'start' | 'center' | 'end';
export type PreviewHighlightBubbleTheme = 'dark' | 'light';

export interface PreviewHighlightBubble {
  text?: string;
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
  mode?: PreviewHighlightMode;
  bubble?: PreviewHighlightBubble;
  label?: string;
  // Allow highlight commands to request preview auto-navigation via target URLs. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  targetUrl?: string;
}

export interface PreviewHighlightEvent {
  id: string;
  command?: PreviewHighlightCommand;
  createdAt: string;
  // Include instance names from preview SSE payloads for routing highlights. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204
  instanceName?: string;
}

// Describe one active preview task group for repo/admin management surfaces. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export interface PreviewManagedTaskGroupSummary {
  taskGroupId: string;
  taskGroupTitle?: string;
  repoId?: string;
  aggregateStatus: PreviewInstanceStatus;
  instances: PreviewInstanceSummary[];
}

// Shape repo preview config responses for the repo detail dashboard. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export interface RepoPreviewInstanceSummary {
  name: string;
  workdir: string;
  display: PreviewInstanceDisplayMode;
}

export interface RepoPreviewConfigResponse {
  available: boolean;
  instances: RepoPreviewInstanceSummary[];
  reason?: 'no_workspace' | 'config_missing' | 'config_invalid' | 'workspace_missing';
  activeTaskGroups: PreviewManagedTaskGroupSummary[];
}

// Describe global preview port allocation diagnostics for admin management pages. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export interface PreviewPortAllocationOwner {
  taskGroupId: string;
  ports: number[];
}

export interface PreviewPortAllocationSnapshot {
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  inUseCount: number;
  availableCount: number;
  inUsePorts: number[];
  allocations: PreviewPortAllocationOwner[];
}

export interface PreviewAdminOverviewResponse {
  generatedAt: string;
  activeTaskGroups: PreviewManagedTaskGroupSummary[];
  portAllocation: PreviewPortAllocationSnapshot;
}

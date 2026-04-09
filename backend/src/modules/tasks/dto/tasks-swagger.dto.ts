import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalRequestDto } from './approvals-swagger.dto';

export class TaskTokenUsageDto {
  @ApiProperty()
  inputTokens!: number;

  @ApiProperty()
  outputTokens!: number;

  @ApiProperty()
  totalTokens!: number;
}

export class TaskGitStatusSnapshotDto {
  // Swagger DTO for git snapshot metadata. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  @ApiProperty()
  branch!: string;

  @ApiProperty()
  headSha!: string;

  @ApiPropertyOptional()
  upstream?: string;

  @ApiPropertyOptional()
  ahead?: number;

  @ApiPropertyOptional()
  behind?: number;

  @ApiPropertyOptional()
  pushRemote?: string;

  @ApiPropertyOptional()
  pushWebUrl?: string;
}

export class TaskGitStatusWorkingTreeDto {
  // Swagger DTO for local file change lists. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  @ApiProperty({ type: String, isArray: true })
  staged!: string[];

  @ApiProperty({ type: String, isArray: true })
  unstaged!: string[];

  @ApiProperty({ type: String, isArray: true })
  untracked!: string[];
}

export class TaskGitStatusDeltaDto {
  // Swagger DTO for branch/commit delta flags. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  @ApiProperty()
  branchChanged!: boolean;

  @ApiProperty()
  headChanged!: boolean;
}

export class TaskGitStatusPushStateDto {
  // Swagger DTO for push/commit sync state. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  @ApiProperty({ enum: ['pushed', 'unpushed', 'unknown', 'error', 'not_applicable'] })
  status!: 'pushed' | 'unpushed' | 'unknown' | 'error' | 'not_applicable';

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  targetBranch?: string;

  @ApiPropertyOptional()
  targetWebUrl?: string;

  @ApiPropertyOptional()
  targetHeadSha?: string;
}

export class TaskGitStatusDto {
  // Swagger DTO for git status payload returned to the UI. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional()
  capturedAt?: string;

  @ApiPropertyOptional({ type: TaskGitStatusSnapshotDto })
  baseline?: TaskGitStatusSnapshotDto;

  @ApiPropertyOptional({ type: TaskGitStatusSnapshotDto })
  final?: TaskGitStatusSnapshotDto;

  @ApiPropertyOptional({ type: TaskGitStatusDeltaDto })
  delta?: TaskGitStatusDeltaDto;

  @ApiPropertyOptional({ type: TaskGitStatusWorkingTreeDto })
  workingTree?: TaskGitStatusWorkingTreeDto;

  @ApiPropertyOptional({ type: TaskGitStatusPushStateDto })
  push?: TaskGitStatusPushStateDto;

  @ApiPropertyOptional({ type: String, isArray: true })
  errors?: string[];
}

export class TaskWorkspaceChangeDto {
  // Swagger DTO for repo-relative workspace diff records returned to task views. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  @ApiProperty()
  path!: string;

  @ApiPropertyOptional({ enum: ['create', 'update', 'delete'] })
  kind?: 'create' | 'update' | 'delete';

  @ApiProperty()
  unifiedDiff!: string;

  @ApiPropertyOptional()
  oldText?: string;

  @ApiPropertyOptional()
  newText?: string;

  @ApiProperty()
  diffHash!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class TaskWorkspaceChangesDto {
  // Swagger DTO for the latest task workspace change snapshot. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  @ApiProperty({ format: 'date-time' })
  capturedAt!: string;

  @ApiProperty({ type: TaskWorkspaceChangeDto, isArray: true })
  files!: TaskWorkspaceChangeDto[];
}

export class TaskProviderRoutingCredentialDto {
  // Swagger DTO for provider credential routing metadata. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
  @ApiProperty({ enum: ['robot', 'repo', 'user'] })
  requestedStoredSource!: 'robot' | 'repo' | 'user';

  @ApiProperty({ enum: ['local', 'robot', 'repo', 'user', 'none'] })
  resolvedLayer!: 'local' | 'robot' | 'repo' | 'user' | 'none';

  @ApiProperty({
    enum: [
      'env_api_key',
      'credentials_file',
      'auth_json_tokens',
      'auth_json_api_key',
      'oauth_creds',
      'robot_embedded',
      'repo_profile',
      'user_profile',
      'none'
    ]
  })
  resolvedMethod!:
    | 'env_api_key'
    | 'credentials_file'
    | 'auth_json_tokens'
    | 'auth_json_api_key'
    | 'oauth_creds'
    | 'robot_embedded'
    | 'repo_profile'
    | 'user_profile'
    | 'none';

  @ApiProperty()
  canExecute!: boolean;

  @ApiPropertyOptional()
  profileId?: string;

  @ApiProperty()
  fallbackUsed!: boolean;

  @ApiPropertyOptional()
  reason?: string;
}

export class TaskProviderRoutingAttemptDto {
  // Swagger DTO for per-attempt provider failover state. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
  @ApiProperty({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  provider!: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiProperty({ enum: ['primary', 'fallback'] })
  role!: 'primary' | 'fallback';

  @ApiProperty({ enum: ['planned', 'skipped', 'running', 'succeeded', 'failed'] })
  status!: 'planned' | 'skipped' | 'running' | 'succeeded' | 'failed';

  @ApiPropertyOptional()
  reason?: string;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  startedAt?: string;

  @ApiPropertyOptional({ format: 'date-time' })
  finishedAt?: string;

  @ApiProperty({ type: TaskProviderRoutingCredentialDto })
  credential!: TaskProviderRoutingCredentialDto;
}

export class TaskProviderRoutingDto {
  // Swagger DTO for provider routing decisions shown in task detail. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
  @ApiProperty({ enum: ['fixed', 'availability_first'] })
  mode!: 'fixed' | 'availability_first';

  @ApiProperty({ enum: ['disabled', 'fallback_provider_once'] })
  failoverPolicy!: 'disabled' | 'fallback_provider_once';

  @ApiProperty({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  primaryProvider!: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiPropertyOptional({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  fallbackProvider?: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiProperty({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  selectedProvider!: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiPropertyOptional({ enum: ['codex', 'claude_code', 'gemini_cli'] })
  finalProvider?: 'codex' | 'claude_code' | 'gemini_cli';

  @ApiProperty()
  selectionReason!: string;

  @ApiProperty()
  failoverTriggered!: boolean;

  @ApiProperty({ type: TaskProviderRoutingAttemptDto, isArray: true })
  attempts!: TaskProviderRoutingAttemptDto[];
}

export class TaskResultDto {
  @ApiPropertyOptional({ enum: ['A', 'B', 'C', 'D'] })
  grade?: 'A' | 'B' | 'C' | 'D';

  @ApiPropertyOptional()
  goLive?: boolean;

  @ApiPropertyOptional()
  summary?: string;

  @ApiPropertyOptional({ type: String, isArray: true })
  risks?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  suggestions?: string[];

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  // Expose worker-loss flags so the UI can explain external executor disconnect failures. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerLost?: boolean;

  @ApiPropertyOptional()
  workerLostReason?: string;

  @ApiPropertyOptional()
  code?: string;

  // Task logs are served via `/tasks/:id/logs` and omitted from task result payloads. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  @ApiPropertyOptional({ type: TaskTokenUsageDto })
  tokenUsage?: TaskTokenUsageDto;

  @ApiPropertyOptional()
  outputText?: string;

  @ApiPropertyOptional()
  providerCommentUrl?: string;

  @ApiPropertyOptional({ type: TaskProviderRoutingDto })
  // Expose provider routing decisions in task result responses for failover visibility. docs/en/developer/plans/providerroutingimpl20260313/task_plan.md providerroutingimpl20260313
  providerRouting?: TaskProviderRoutingDto;

  @ApiPropertyOptional({ enum: ['allow', 'allow_with_warning', 'require_approval', 'deny'] })
  policyDecision?: 'allow' | 'allow_with_warning' | 'require_approval' | 'deny';

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'] })
  policyRiskLevel?: 'low' | 'medium' | 'high' | 'critical';

  // Expose git status payload in task result responses. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  @ApiPropertyOptional({ type: TaskGitStatusDto })
  gitStatus?: TaskGitStatusDto;

  // Expose persisted workspace diff snapshots for live/history task views. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  @ApiPropertyOptional({ type: TaskWorkspaceChangesDto, nullable: true })
  workspaceChanges?: TaskWorkspaceChangesDto | null;
}

export class DependencyInstallStepDto {
  // Swagger DTO for dependency install steps recorded per task. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  @ApiProperty({ enum: ['node', 'python', 'java', 'ruby', 'go'] })
  language!: 'node' | 'python' | 'java' | 'ruby' | 'go';

  @ApiPropertyOptional()
  command?: string;

  @ApiPropertyOptional()
  workdir?: string;

  @ApiProperty({ enum: ['success', 'skipped', 'failed'] })
  status!: 'success' | 'skipped' | 'failed';

  @ApiPropertyOptional()
  duration?: number;

  @ApiPropertyOptional()
  error?: string;

  @ApiPropertyOptional()
  reason?: string;
}

export class DependencyResultDto {
  @ApiProperty({ enum: ['success', 'partial', 'skipped', 'failed'] })
  status!: 'success' | 'partial' | 'skipped' | 'failed';

  @ApiProperty({ type: DependencyInstallStepDto, isArray: true })
  steps!: DependencyInstallStepDto[];

  @ApiProperty()
  totalDuration!: number;
}

export class TaskRepoSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: ['gitlab', 'github'] })
  provider!: 'gitlab' | 'github';

  @ApiProperty()
  name!: string;

  @ApiProperty()
  enabled!: boolean;
}

export class TaskRobotSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  repoId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['read', 'write'] })
  permission!: 'read' | 'write';

  @ApiProperty()
  enabled!: boolean;
}

export class TaskWorkerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['local', 'remote'] })
  kind!: 'local' | 'remote';

  @ApiProperty({ enum: ['online', 'offline', 'disabled'] })
  status!: 'online' | 'offline' | 'disabled';

  @ApiPropertyOptional()
  preview?: boolean;
}

export class TaskPermissionsDto {
  @ApiProperty()
  canManage!: boolean;
}

export class WorkerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['local', 'remote'] })
  kind!: 'local' | 'remote';

  @ApiProperty({ enum: ['online', 'offline', 'disabled'] })
  status!: 'online' | 'offline' | 'disabled';

  @ApiProperty()
  isGlobalDefault!: boolean;

  @ApiPropertyOptional()
  preview?: boolean;
}

export class TaskQueueTimeWindowDto {
  // Surface resolved time window metadata for queue explanations. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  @ApiProperty()
  startHour!: number;

  @ApiProperty()
  endHour!: number;

  @ApiProperty({ enum: ['robot', 'trigger', 'chat'] })
  source!: 'robot' | 'trigger' | 'chat';

  @ApiProperty({ enum: ['server'] })
  timezone!: 'server';
}

export class TaskQueueDiagnosisDto {
  // Describe queued task diagnosis for the console UI. f3a9c2d8e1b7f4a0c6d1
  @ApiProperty({ enum: ['queue_backlog', 'no_active_worker', 'inline_worker_disabled', 'outside_time_window', 'unknown'] })
  reasonCode!: 'queue_backlog' | 'no_active_worker' | 'inline_worker_disabled' | 'outside_time_window' | 'unknown';

  @ApiProperty()
  ahead!: number;

  @ApiProperty()
  queuedTotal!: number;

  @ApiProperty()
  processing!: number;

  @ApiProperty()
  staleProcessing!: number;

  @ApiProperty()
  inlineWorkerEnabled!: boolean;

  @ApiPropertyOptional({ type: TaskQueueTimeWindowDto })
  timeWindow?: TaskQueueTimeWindowDto;
}

export class TaskWithMetaDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ nullable: true })
  groupId?: string | null;

  @ApiProperty()
  eventType!: string;

  // Keep task status enums aligned with the stop-only execution model. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  @ApiProperty({ enum: ['queued', 'waiting_approval', 'processing', 'succeeded', 'failed', 'commented'] })
  status!: 'queued' | 'waiting_approval' | 'processing' | 'succeeded' | 'failed' | 'commented';

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  archivedAt?: string | null;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  projectId?: number;

  // Surface dependency install results on task responses. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  @ApiPropertyOptional({ type: DependencyResultDto })
  dependencyResult?: DependencyResultDto;

  @ApiPropertyOptional({ enum: ['gitlab', 'github'], nullable: true })
  repoProvider?: 'gitlab' | 'github' | null;

  @ApiPropertyOptional({ nullable: true })
  repoId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  robotId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  // Surface the assigned executor id for task attribution and worker-aware actions. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  workerId?: string | null;

  // Expose triggering user for notifications and audit contexts. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  @ApiPropertyOptional({ nullable: true })
  actorUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  ref?: string | null;

  @ApiPropertyOptional()
  mrId?: number;

  @ApiPropertyOptional()
  issueId?: number;

  @ApiProperty()
  retries!: number;

  @ApiPropertyOptional({ type: TaskQueueDiagnosisDto })
  queue?: TaskQueueDiagnosisDto;

  @ApiPropertyOptional({ type: TaskResultDto })
  result?: TaskResultDto;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  workerLostAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ type: TaskRepoSummaryDto })
  repo?: TaskRepoSummaryDto;

  @ApiPropertyOptional({ type: TaskRobotSummaryDto })
  robot?: TaskRobotSummaryDto;

  @ApiPropertyOptional({ type: WorkerSummaryDto })
  workerSummary?: WorkerSummaryDto;

  @ApiPropertyOptional({ type: TaskPermissionsDto })
  permissions?: TaskPermissionsDto;

  @ApiPropertyOptional({ type: ApprovalRequestDto })
  approvalRequest?: ApprovalRequestDto;
}

export class ListTasksResponseDto {
  @ApiProperty({ type: TaskWithMetaDto, isArray: true })
  tasks!: TaskWithMetaDto[];

  // Add nextCursor to task list responses for keyset pagination. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  @ApiPropertyOptional()
  nextCursor?: string;
}

export class TaskStatusStatsDto {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  queued!: number;

  @ApiProperty()
  processing!: number;

  @ApiProperty()
  success!: number;

  @ApiProperty()
  failed!: number;
}

export class TaskStatsResponseDto {
  @ApiProperty({ type: TaskStatusStatsDto })
  stats!: TaskStatusStatsDto;
}

export class GetTaskResponseDto {
  @ApiProperty({ type: TaskWithMetaDto })
  task!: TaskWithMetaDto;
}

export class RetryTaskResponseDto {
  @ApiProperty({ type: TaskWithMetaDto })
  task!: TaskWithMetaDto;
}

// Shared task response payload for stop/edit/reorder controls. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
export class TaskControlResponseDto {
  @ApiProperty({ type: TaskWithMetaDto })
  task!: TaskWithMetaDto;
}

export class TaskLogsResponseDto {
  // Expose pagination metadata for task log pages. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  @ApiProperty({ type: String, isArray: true })
  logs!: string[];

  @ApiProperty({ example: 1, description: 'Sequence number of the first log line in this page.' })
  startSeq!: number;

  @ApiProperty({ example: 200, description: 'Sequence number of the last log line in this page.' })
  endSeq!: number;

  @ApiProperty({ required: false, description: 'Cursor for fetching earlier log lines.' })
  nextBefore?: number;
}

export class TaskVolumePointDto {
  // Describe daily task volume points for the repo dashboard trend chart. dashtrendline20260119m9v2
  @ApiProperty({ example: '2026-01-19', description: 'UTC day bucket in YYYY-MM-DD format.' })
  day!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

export class TaskVolumeByDayResponseDto {
  @ApiProperty({ type: TaskVolumePointDto, isArray: true })
  points!: TaskVolumePointDto[];
}

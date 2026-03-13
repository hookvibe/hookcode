import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApprovalActionRequestDto {
  @ApiPropertyOptional()
  note?: string;
}

export class ApprovalActionDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  actorUserId?: string;

  @ApiProperty({ enum: ['requested', 'approve', 'reject', 'request_changes', 'approve_once', 'approve_always'] })
  action!: 'requested' | 'approve' | 'reject' | 'request_changes' | 'approve_once' | 'approve_always';

  @ApiPropertyOptional()
  note?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class ApprovalMatchedRuleDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['allow', 'allow_with_warning', 'require_approval', 'deny'] })
  action!: 'allow' | 'allow_with_warning' | 'require_approval' | 'deny';

  @ApiProperty({ enum: ['policy_rule', 'builtin'] })
  source!: 'policy_rule' | 'builtin';
}

export class ApprovalDetailsDto {
  @ApiProperty({ enum: ['chat', 'webhook', 'system'] })
  taskSource!: 'chat' | 'webhook' | 'system';

  @ApiPropertyOptional()
  provider?: string;

  @ApiProperty({ enum: ['read-only', 'workspace-write', 'unknown'] })
  sandbox!: 'read-only' | 'workspace-write' | 'unknown';

  @ApiProperty()
  networkAccess!: boolean;

  @ApiProperty({ type: String, isArray: true })
  targetFiles!: string[];

  @ApiProperty({ type: String, isArray: true })
  commands!: string[];

  @ApiProperty({ type: String, isArray: true })
  reasons!: string[];

  @ApiProperty({ type: String, isArray: true })
  warnings!: string[];

  @ApiProperty({ type: ApprovalMatchedRuleDto, isArray: true })
  matchedRules!: ApprovalMatchedRuleDto[];
}

export class ApprovalTaskSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiPropertyOptional()
  repoName?: string;

  @ApiPropertyOptional()
  robotId?: string;

  @ApiPropertyOptional()
  robotName?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ApprovalRequestDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  taskId!: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiPropertyOptional()
  robotId?: string;

  @ApiPropertyOptional()
  requestedByUserId?: string;

  @ApiPropertyOptional()
  resolvedByUserId?: string;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected', 'changes_requested'] })
  status!: 'pending' | 'approved' | 'rejected' | 'changes_requested';

  @ApiProperty({ enum: ['allow', 'allow_with_warning', 'require_approval', 'deny'] })
  decision!: 'allow' | 'allow_with_warning' | 'require_approval' | 'deny';

  @ApiProperty({ enum: ['low', 'medium', 'high', 'critical'] })
  riskLevel!: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty()
  summary!: string;

  @ApiPropertyOptional({ type: ApprovalDetailsDto })
  details?: ApprovalDetailsDto;

  @ApiPropertyOptional({ format: 'date-time' })
  resolvedAt?: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: ApprovalActionDto, isArray: true })
  actions!: ApprovalActionDto[];

  @ApiPropertyOptional({ type: ApprovalTaskSummaryDto })
  taskSummary?: ApprovalTaskSummaryDto;
}

export class ApprovalActionResponseDto {
  @ApiProperty({ type: ApprovalRequestDto })
  approval!: ApprovalRequestDto;
}

export class ListApprovalsResponseDto {
  @ApiProperty({ type: ApprovalRequestDto, isArray: true })
  approvals!: ApprovalRequestDto[];

  @ApiPropertyOptional()
  nextCursor?: string;
}

export class PolicyRuleConditionsDto {
  @ApiPropertyOptional({ type: String, isArray: true })
  providers?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  repoProviders?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  eventTypes?: string[];

  @ApiPropertyOptional({ enum: ['chat', 'webhook', 'system'], isArray: true })
  taskSources?: Array<'chat' | 'webhook' | 'system'>;

  @ApiPropertyOptional({ enum: ['read-only', 'workspace-write'], isArray: true })
  sandboxes?: Array<'read-only' | 'workspace-write'>;

  @ApiPropertyOptional()
  networkAccess?: boolean;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high', 'critical'], isArray: true })
  riskLevels?: Array<'low' | 'medium' | 'high' | 'critical'>;

  @ApiPropertyOptional({ type: String, isArray: true })
  targetFilePatterns?: string[];

  @ApiPropertyOptional({ type: String, isArray: true })
  commandPatterns?: string[];
}

export class PolicyRuleDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiPropertyOptional()
  robotId?: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiProperty()
  priority!: number;

  @ApiProperty({ enum: ['allow', 'allow_with_warning', 'require_approval', 'deny'] })
  action!: 'allow' | 'allow_with_warning' | 'require_approval' | 'deny';

  @ApiPropertyOptional({ type: PolicyRuleConditionsDto })
  conditions?: PolicyRuleConditionsDto;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ListPoliciesResponseDto {
  @ApiProperty({ type: PolicyRuleDto, isArray: true })
  rules!: PolicyRuleDto[];
}

export class PolicyRuleUpsertDto {
  @ApiPropertyOptional()
  id?: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiPropertyOptional()
  robotId?: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  enabled?: boolean;

  @ApiPropertyOptional()
  priority?: number;

  @ApiProperty({ enum: ['allow', 'allow_with_warning', 'require_approval', 'deny'] })
  action!: 'allow' | 'allow_with_warning' | 'require_approval' | 'deny';

  @ApiPropertyOptional({ type: PolicyRuleConditionsDto })
  conditions?: PolicyRuleConditionsDto;
}

export class PatchPoliciesRequestDto {
  @ApiProperty({ type: PolicyRuleUpsertDto, isArray: true })
  rules!: PolicyRuleUpsertDto[];
}

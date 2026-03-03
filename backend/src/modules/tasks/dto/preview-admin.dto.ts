import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Describe per-instance preview runtime status in admin overview payloads. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class PreviewAdminInstanceDto {
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['stopped', 'starting', 'running', 'failed', 'timeout'] })
  status!: 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

  @ApiPropertyOptional()
  port?: number;

  @ApiPropertyOptional()
  path?: string;

  @ApiPropertyOptional()
  publicUrl?: string;

  @ApiPropertyOptional()
  message?: string;
}

// Describe one active preview task group in admin management responses. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class PreviewAdminTaskGroupDto {
  @ApiProperty()
  taskGroupId!: string;

  @ApiPropertyOptional()
  taskGroupTitle?: string;

  @ApiPropertyOptional()
  repoId?: string;

  @ApiProperty({ enum: ['stopped', 'starting', 'running', 'failed', 'timeout'] })
  aggregateStatus!: 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

  @ApiProperty({ type: PreviewAdminInstanceDto, isArray: true })
  instances!: PreviewAdminInstanceDto[];
}

// Describe preview port ownership for each active task group. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class PreviewPortAllocationOwnerDto {
  @ApiProperty()
  taskGroupId!: string;

  @ApiProperty({ type: Number, isArray: true })
  ports!: number[];
}

// Describe preview port range usage for admin diagnostics. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class PreviewPortAllocationDto {
  @ApiProperty()
  rangeStart!: number;

  @ApiProperty()
  rangeEnd!: number;

  @ApiProperty()
  capacity!: number;

  @ApiProperty()
  inUseCount!: number;

  @ApiProperty()
  availableCount!: number;

  @ApiProperty({ type: Number, isArray: true })
  inUsePorts!: number[];

  @ApiProperty({ type: PreviewPortAllocationOwnerDto, isArray: true })
  allocations!: PreviewPortAllocationOwnerDto[];
}

// Swagger response for the admin preview management overview endpoint. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export class PreviewAdminOverviewResponseDto {
  @ApiProperty()
  generatedAt!: string;

  @ApiProperty({ type: PreviewAdminTaskGroupDto, isArray: true })
  activeTaskGroups!: PreviewAdminTaskGroupDto[];

  @ApiProperty({ type: PreviewPortAllocationDto })
  portAllocation!: PreviewPortAllocationDto;
}

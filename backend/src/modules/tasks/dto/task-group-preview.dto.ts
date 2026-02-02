import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { DependencyResultDto } from './tasks-swagger.dto';

export class PreviewLogEntryDto {
  // Preview log entry payload used by diagnostics and log streaming. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  timestamp!: string;

  @ApiProperty({ enum: ['stdout', 'stderr', 'system'] })
  level!: 'stdout' | 'stderr' | 'system';

  @ApiProperty()
  message!: string;
}

export class PreviewDiagnosticsDto {
  // Structured diagnostics included with failed/timeout preview instances. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiPropertyOptional({ nullable: true })
  exitCode?: number | null;

  @ApiPropertyOptional({ nullable: true })
  signal?: string | null;

  @ApiPropertyOptional({ type: () => PreviewLogEntryDto, isArray: true })
  logs?: PreviewLogEntryDto[];
}

export class PreviewInstanceDto {
  // Preview instance status returned by the TaskGroup preview APIs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['stopped', 'starting', 'running', 'failed', 'timeout'] })
  status!: 'stopped' | 'starting' | 'running' | 'failed' | 'timeout';

  @ApiPropertyOptional()
  port?: number;

  @ApiPropertyOptional()
  path?: string;

  // Include public preview URLs for subdomain routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiPropertyOptional()
  publicUrl?: string;

  @ApiPropertyOptional()
  message?: string;

  // Attach diagnostics for failed preview instances in Phase 3. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiPropertyOptional({
    type: () => PreviewDiagnosticsDto
  })
  diagnostics?: PreviewDiagnosticsDto;
}

export class PreviewStatusResponseDto {
  // Response payload for preview status checks. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  available!: boolean;

  @ApiProperty({ type: PreviewInstanceDto, isArray: true })
  instances!: PreviewInstanceDto[];

  @ApiPropertyOptional({ enum: ['config_missing', 'config_invalid', 'workspace_missing', 'invalid_group', 'missing_task'] })
  reason?: 'config_missing' | 'config_invalid' | 'workspace_missing' | 'invalid_group' | 'missing_task';
}

export class PreviewStartResponseDto {
  // Start preview response payload. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: PreviewInstanceDto, isArray: true })
  instances!: PreviewInstanceDto[];
}

export class PreviewStopResponseDto {
  // Stop preview response payload. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;
}

export class PreviewDependencyInstallResponseDto {
  // Preview dependency install response payload for manual reinstall. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: DependencyResultDto })
  result!: DependencyResultDto;
}

export class PreviewHighlightBubbleDto {
  // Describe tooltip bubble rendering alongside preview highlights. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  @ApiProperty({ description: 'Bubble text rendered near the highlighted element.' })
  @IsString()
  @MinLength(1)
  @MaxLength(280)
  text!: string;

  @ApiPropertyOptional({
    enum: ['top', 'right', 'bottom', 'left', 'auto'],
    description: 'Preferred bubble placement relative to the highlight.'
  })
  @IsOptional()
  @IsIn(['top', 'right', 'bottom', 'left', 'auto'])
  placement?: 'top' | 'right' | 'bottom' | 'left' | 'auto';

  @ApiPropertyOptional({
    enum: ['start', 'center', 'end'],
    description: 'Alignment along the target edge (start/center/end).'
  })
  @IsOptional()
  @IsIn(['start', 'center', 'end'])
  align?: 'start' | 'center' | 'end';

  @ApiPropertyOptional({ description: 'Gap in pixels between highlight and bubble.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(64)
  offset?: number;

  @ApiPropertyOptional({ description: 'Maximum bubble width in pixels.' })
  @IsOptional()
  @IsNumber()
  @Min(120)
  @Max(640)
  maxWidth?: number;

  @ApiPropertyOptional({
    enum: ['dark', 'light'],
    description: 'Bubble theme preset (dark/light).'
  })
  @IsOptional()
  @IsIn(['dark', 'light'])
  theme?: 'dark' | 'light';

  @ApiPropertyOptional({ description: 'Bubble background color (CSS value override).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  background?: string;

  @ApiPropertyOptional({ description: 'Bubble text color (CSS value override).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  textColor?: string;

  @ApiPropertyOptional({ description: 'Bubble border color (CSS value override).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  borderColor?: string;

  @ApiPropertyOptional({ description: 'Bubble corner radius in pixels.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(24)
  radius?: number;

  @ApiPropertyOptional({ description: 'Whether the bubble arrow pointer is visible.' })
  @IsOptional()
  @IsBoolean()
  arrow?: boolean;
}

export class PreviewHighlightRequestDto {
  // Describe DOM highlight commands sent to preview bridge scripts. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty({ description: 'CSS selector to highlight in the preview iframe.' })
  @IsString()
  @MaxLength(200)
  selector!: string;

  @ApiPropertyOptional({ description: 'Padding in pixels around the highlighted element.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(64)
  padding?: number;

  @ApiPropertyOptional({ description: 'Highlight color (CSS value).' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  color?: string;

  @ApiPropertyOptional({ enum: ['outline', 'mask'], description: 'Highlight mode.' })
  @IsOptional()
  @IsIn(['outline', 'mask'])
  mode?: 'outline' | 'mask';

  @ApiPropertyOptional({ description: 'Scroll element into view before highlighting.' })
  @IsOptional()
  @IsBoolean()
  scrollIntoView?: boolean;

  @ApiPropertyOptional({
    description: 'Optional bubble tooltip configuration rendered near the highlight.',
    type: PreviewHighlightBubbleDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PreviewHighlightBubbleDto)
  // Attach bubble tooltip data to highlight commands. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48
  bubble?: PreviewHighlightBubbleDto;

  @ApiPropertyOptional({ description: 'Optional request identifier for client-side tracking.' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  requestId?: string;
}

export class PreviewHighlightResponseDto {
  // Preview highlight API response for bridge delivery. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ description: 'Request identifier for the highlight command.' })
  requestId!: string;

  @ApiProperty({ description: 'Number of SSE subscribers receiving the command.' })
  subscribers!: number;
}

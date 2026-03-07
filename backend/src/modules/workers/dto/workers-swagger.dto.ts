import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

const trimString = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);

class WorkerSummaryDto {
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

class WorkerRecordDto extends WorkerSummaryDto {
  @ApiProperty()
  systemManaged!: boolean;

  @ApiPropertyOptional()
  version?: string;

  @ApiPropertyOptional()
  platform?: string;

  @ApiPropertyOptional()
  arch?: string;

  @ApiPropertyOptional()
  hostname?: string;

  @ApiPropertyOptional()
  backendBaseUrl?: string;

  @ApiPropertyOptional()
  capabilities?: unknown;

  @ApiPropertyOptional()
  runtimeState?: unknown;

  @ApiProperty()
  maxConcurrency!: number;

  @ApiProperty()
  currentConcurrency!: number;

  @ApiPropertyOptional()
  lastSeenAt?: string;

  @ApiPropertyOptional()
  lastHelloAt?: string;

  @ApiPropertyOptional()
  disabledAt?: string;

  @ApiPropertyOptional()
  createdByUserId?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class ListWorkersResponseDto {
  @ApiProperty({ type: [WorkerRecordDto] })
  workers!: WorkerRecordDto[];
}

export class WorkerBootstrapResponseDto {
  @ApiProperty({ type: WorkerRecordDto })
  worker!: WorkerRecordDto;

  @ApiProperty()
  workerId!: string;

  @ApiProperty()
  token!: string;

  @ApiProperty()
  backendUrl!: string;

  @ApiProperty()
  wsUrl!: string;
}

export class UpdateWorkerRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  // Keep worker mutation DTO fields whitelisted under Nest validation so admin status/name updates survive request-body stripping. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  name?: string;

  @ApiPropertyOptional({ enum: ['online', 'offline', 'disabled'] })
  @IsOptional()
  @IsIn(['online', 'offline', 'disabled'])
  status?: 'online' | 'offline' | 'disabled';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxConcurrency?: number;
}

export class CreateWorkerRequestDto {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  // Preserve and validate remote-worker bootstrap fields under ValidationPipe whitelist so localhost/admin create requests keep their submitted worker names. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxConcurrency?: number;
}

export class PrepareRuntimeRequestDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => trimString(item)).filter((item) => typeof item === 'string' && item) : value))
  // Preserve provider lists for runtime preparation requests so connected workers receive explicit install targets after whitelist filtering. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
  providers?: string[];
}

export class WorkerContextDto {
  @ApiProperty()
  task!: unknown;

  @ApiPropertyOptional()
  repo?: unknown;

  @ApiPropertyOptional()
  repoScopedCredentials?: unknown;

  @ApiPropertyOptional({ type: [Object] })
  robotsInRepo?: unknown[];

  @ApiPropertyOptional()
  defaultUserCredentials?: unknown;
}

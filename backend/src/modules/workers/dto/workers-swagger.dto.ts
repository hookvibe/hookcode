import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { normalizeWorkerApiBaseUrl } from '../worker-public-url';

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

  @ApiProperty()
  isGlobalDefault!: boolean;

  @ApiPropertyOptional()
  preview?: boolean;
}

class WorkerRecordDto extends WorkerSummaryDto {
  @ApiProperty()
  systemManaged!: boolean;

  @ApiPropertyOptional()
  version?: string;

  @ApiProperty({ type: Object })
  versionState!: {
    currentVersion?: string;
    status: 'compatible' | 'mismatch' | 'unknown';
    upgradeRequired: boolean;
  };

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

class WorkerVersionRequirementDto {
  @ApiProperty()
  packageName!: string;

  @ApiProperty()
  requiredVersion!: string;

  @ApiProperty()
  npmInstallCommand!: string;

  @ApiProperty()
  cliUpgradeCommand!: string;

  @ApiProperty()
  dockerImage!: string;

  @ApiProperty()
  dockerPullCommand!: string;
}

export class ListWorkersResponseDto {
  @ApiProperty({ type: [WorkerRecordDto] })
  workers!: WorkerRecordDto[];

  @ApiProperty({ type: WorkerVersionRequirementDto })
  versionRequirement!: WorkerVersionRequirementDto;

  @ApiProperty()
  defaultBackendUrl!: string;
}

export class WorkerResponseDto {
  @ApiProperty({ type: WorkerRecordDto })
  worker!: WorkerRecordDto;
}

export class WorkerBindResponseDto {
  @ApiProperty({ type: WorkerRecordDto })
  worker!: WorkerRecordDto;

  @ApiProperty()
  bindCode!: string;

  @ApiProperty()
  bindCodeExpiresAt!: string;

  @ApiProperty()
  backendUrl!: string;

  @ApiProperty({ type: WorkerVersionRequirementDto })
  versionRequirement!: WorkerVersionRequirementDto;
}

export class RegisterWorkerRequestDto {
  @ApiProperty()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
  bindCode!: string;
}

export class RegisterWorkerResponseDto {
  @ApiProperty()
  workerId!: string;

  @ApiProperty()
  workerToken!: string;

  @ApiProperty()
  backendUrl!: string;
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isGlobalDefault?: boolean;
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

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeWorkerApiBaseUrl(value))
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  backendUrl?: string;
}

export class ResetWorkerBindCodeRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => normalizeWorkerApiBaseUrl(value))
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  backendUrl?: string;
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

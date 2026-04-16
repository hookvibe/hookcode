import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

const trimString = (value: unknown): unknown => (typeof value === 'string' ? value.trim() : value);

class WorkerSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['remote'] })
  kind!: 'remote';

  @ApiProperty({ enum: ['online', 'offline', 'disabled'] })
  status!: 'online' | 'offline' | 'disabled';

  @ApiProperty()
  isGlobalDefault!: boolean;

  @ApiPropertyOptional()
  preview?: boolean;
}

class WorkerRecordDto extends WorkerSummaryDto {

  @ApiPropertyOptional()
  version?: string;

  @ApiPropertyOptional()
  platform?: string;

  @ApiPropertyOptional()
  arch?: string;

  @ApiPropertyOptional()
  hostname?: string;

  @ApiPropertyOptional({ type: [String] })
  providers?: string[];

  @ApiProperty()
  maxConcurrency!: number;

  @ApiProperty()
  activeTaskCount!: number;

  @ApiPropertyOptional()
  lastHeartbeatAt?: string;

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

  @ApiProperty()
  defaultBackendUrl!: string;
}

export class WorkerResponseDto {
  @ApiProperty({ type: WorkerRecordDto })
  worker!: WorkerRecordDto;
}

export class UpdateWorkerRequestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @IsNotEmpty()
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
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxConcurrency?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => trimString(item)).filter((item) => typeof item === 'string' && item) : value))
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

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RuntimeInfoDto {
  // Swagger DTO for runtime detection data exposed by `/system/runtimes`. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  @ApiProperty({ enum: ['node', 'python', 'java', 'ruby', 'go'] })
  language!: 'node' | 'python' | 'java' | 'ruby' | 'go';

  @ApiProperty()
  version!: string;

  @ApiProperty()
  path!: string;

  @ApiPropertyOptional()
  packageManager?: string;
}

export class SystemRuntimesResponseDto {
  @ApiProperty({ type: RuntimeInfoDto, isArray: true })
  runtimes!: RuntimeInfoDto[];

  @ApiPropertyOptional()
  detectedAt?: string;
}

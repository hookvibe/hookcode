import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

// Define skill selection DTOs for repo/task-group APIs. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
export class SkillSelectionStateDto {
  @ApiPropertyOptional({ type: String, isArray: true, nullable: true })
  selection?: string[] | null;

  @ApiProperty({ type: String, isArray: true })
  effective!: string[];

  @ApiProperty({ enum: ['custom', 'repo_default', 'all'] })
  mode!: 'custom' | 'repo_default' | 'all';
}

export class SkillSelectionPatchDto {
  @ApiPropertyOptional({ type: String, isArray: true, nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selection?: string[] | null;
}

export class SkillSelectionResponseDto {
  @ApiProperty({ type: SkillSelectionStateDto })
  selection!: SkillSelectionStateDto;
}

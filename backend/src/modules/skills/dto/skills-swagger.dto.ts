// Swagger DTOs for the skill registry APIs. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SkillSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description?: string | null;

  @ApiPropertyOptional({ nullable: true })
  version?: string | null;

  @ApiProperty({ enum: ['built_in', 'extra'] })
  source!: 'built_in' | 'extra';

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  promptText?: string | null;

  @ApiProperty()
  promptEnabled!: boolean;

  // Expose skill tags for UI filtering and grouping. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  @ApiProperty({ type: String, isArray: true })
  tags!: string[];
}

export class ListSkillsResponseDto {
  @ApiProperty({ type: SkillSummaryDto, isArray: true })
  builtIn!: SkillSummaryDto[];

  @ApiProperty({ type: SkillSummaryDto, isArray: true })
  extra!: SkillSummaryDto[];

  // Paginate built-in skills with an optional cursor. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  @ApiPropertyOptional()
  builtInNextCursor?: string;

  // Paginate extra skills with an optional cursor. docs/en/developer/plans/pagination-impl-20260227-b/task_plan.md pagination-impl-20260227-b
  @ApiPropertyOptional()
  extraNextCursor?: string;
}

export class UpdateSkillDto {
  @ApiPropertyOptional({ description: 'Enable or disable the extra skill.' })
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'Whether to prepend the skill prompt text.' })
  promptEnabled?: boolean;

  // Allow tag updates from the skills registry UI. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  @ApiPropertyOptional({ type: String, isArray: true, description: 'Tags for skill filtering and classification.' })
  tags?: string[];
}

export class UpdateSkillResponseDto {
  @ApiProperty({ type: SkillSummaryDto })
  skill!: SkillSummaryDto;
}

export class UploadSkillResponseDto {
  // Return the newly registered extra skill after upload. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  @ApiProperty({ type: SkillSummaryDto })
  skill!: SkillSummaryDto;
}

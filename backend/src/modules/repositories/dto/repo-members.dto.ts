import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// DTOs for repo member invite and role updates. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class CreateRepoInviteDto {
  @ApiPropertyOptional({ description: 'Invitee email.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  email?: string;

  @ApiPropertyOptional({ description: 'Role (owner/maintainer/member).' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  role?: string;
}

export class AcceptRepoInviteDto {
  @ApiPropertyOptional({ description: 'Invitee email.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  email?: string;

  @ApiPropertyOptional({ description: 'Invite token.' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  token?: string;
}

export class UpdateRepoMemberDto {
  @ApiPropertyOptional({ description: 'Role (owner/maintainer/member).' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  role?: string;
}

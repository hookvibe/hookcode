import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiPropertyOptional({ nullable: true })
  // Expose email for account management flows. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  displayName?: string | null;

  @ApiProperty()
  disabled!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  emailVerifiedAt?: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class UserWithRolesDto extends UserDto {
  @ApiProperty({ type: String, isArray: true })
  roles!: string[];
}

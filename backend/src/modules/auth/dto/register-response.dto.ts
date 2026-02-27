import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserWithRolesDto } from '../../users/dto/user.dto';

// Response schema for register endpoint. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export class RegisterResponseDto {
  @ApiProperty({ description: 'Registration status.' })
  status!: 'ok' | 'pending_verification';

  @ApiPropertyOptional({ format: 'date-time' })
  expiresAt?: string;

  @ApiPropertyOptional()
  token?: string;

  @ApiPropertyOptional({ type: UserWithRolesDto })
  user?: UserWithRolesDto;

  @ApiPropertyOptional()
  email?: string;
}

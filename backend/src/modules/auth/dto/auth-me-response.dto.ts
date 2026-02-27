import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserWithRolesDto } from '../../users/dto/user.dto';

// Expand auth feature flags for registration. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
class AuthMeFeaturesDto {
  @ApiProperty()
  taskLogsEnabled!: boolean;

  @ApiProperty()
  registerEnabled!: boolean;

  @ApiProperty()
  registerRequireEmailVerify!: boolean;
}

class AuthMeTokenDto {
  @ApiPropertyOptional()
  iat?: number;

  @ApiPropertyOptional()
  exp?: number;
}

export class AuthMeResponseDto {
  @ApiProperty()
  authEnabled!: boolean;

  @ApiProperty({ type: UserWithRolesDto, nullable: true })
  user!: UserWithRolesDto | null;

  @ApiProperty({ type: AuthMeFeaturesDto })
  features!: AuthMeFeaturesDto;

  @ApiPropertyOptional({ type: AuthMeTokenDto })
  token?: AuthMeTokenDto;
}

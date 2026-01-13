import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserWithRolesDto } from '../../users/dto/user.dto';

class AuthMeFeaturesDto {
  @ApiProperty()
  taskLogsEnabled!: boolean;
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

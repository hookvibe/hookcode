import { ApiProperty } from '@nestjs/swagger';
import { UserWithRolesDto } from '../../users/dto/user.dto';

export class LoginResponseDto {
  @ApiProperty({ description: "Bearer token (without the 'Bearer' prefix)." })
  token!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty({ type: UserWithRolesDto })
  user!: UserWithRolesDto;
}


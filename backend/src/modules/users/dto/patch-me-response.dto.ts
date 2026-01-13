import { ApiProperty } from '@nestjs/swagger';
import { UserDto } from './user.dto';

export class PatchMeResponseDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;
}


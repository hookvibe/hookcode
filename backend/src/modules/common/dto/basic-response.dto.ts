import { ApiProperty } from '@nestjs/swagger';

export class SuccessResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;
}

export class OkResponseDto {
  @ApiProperty({ example: true })
  ok!: boolean;
}


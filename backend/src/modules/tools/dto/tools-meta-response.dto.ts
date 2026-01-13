import { ApiProperty } from '@nestjs/swagger';

class ToolsPortsDto {
  @ApiProperty()
  prisma!: number;

  @ApiProperty()
  swagger!: number;
}

export class ToolsMetaResponseDto {
  @ApiProperty()
  enabled!: boolean;

  @ApiProperty({ type: ToolsPortsDto })
  ports!: ToolsPortsDto;
}


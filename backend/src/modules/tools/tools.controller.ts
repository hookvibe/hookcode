import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { loadAdminToolsConfig } from '../../adminTools/config';
import { ToolsMetaResponseDto } from './dto/tools-meta-response.dto';

@Controller('tools')
@ApiTags('Tools')
@ApiBearerAuth('bearerAuth')
export class ToolsController {
  @Get('meta')
  @ApiOperation({
    summary: 'System tools meta',
    description: 'Returns whether admin tools are enabled and exposed ports.',
    operationId: 'tools_meta'
  })
  @ApiOkResponse({ description: 'OK', type: ToolsMetaResponseDto })
  meta() {
    const cfg = loadAdminToolsConfig();
    return {
      enabled: cfg.enabled,
      ports: {
        prisma: cfg.prismaPort,
        swagger: cfg.swaggerPort
      }
    };
  }
}

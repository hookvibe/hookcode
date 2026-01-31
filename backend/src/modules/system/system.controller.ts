import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { RuntimeService } from '../../services/runtimeService';
import { AuthScopeGroup } from '../auth/auth.decorator';
import { SystemRuntimesResponseDto } from './dto/system-runtimes-response.dto';

@AuthScopeGroup('system') // Scope system APIs for PAT access control. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller('system')
@ApiTags('System')
@ApiBearerAuth('bearerAuth')
export class SystemController {
  constructor(private readonly runtimeService: RuntimeService) {}

  @Get('runtimes')
  @ApiOperation({
    summary: 'List detected runtimes',
    description: 'Returns language runtimes detected on the server container.',
    operationId: 'system_runtimes'
  })
  @ApiOkResponse({ description: 'OK', type: SystemRuntimesResponseDto })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getRuntimes(@Req() req: Request) {
    // Require authentication before exposing runtime details. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (!req.user) throw new UnauthorizedException({ error: 'Unauthorized' });
    return {
      runtimes: this.runtimeService.getRuntimes(),
      detectedAt: this.runtimeService.getDetectedAt()
    };
  }
}

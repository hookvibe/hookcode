import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { pingDb } from '../../db';
import { AuthScopeGroup, HealthCheck } from '../auth/auth.decorator';
import { HealthResponseDto } from './dto/health-response.dto';

@AuthScopeGroup('system') // Scope health APIs for PAT access control when auth is enforced. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
@Controller()
@ApiTags('Health')
export class HealthController {
  @Get('health')
  @HealthCheck()
  @ApiOperation({
    summary: 'Health check',
    description: 'Check service and DB connectivity.',
    operationId: 'health_get'
  })
  @ApiOkResponse({ description: 'OK', type: HealthResponseDto })
  async health() {
    const dbOk = await pingDb();
    return {
      status: 'ok',
      db: dbOk ? 'up' : 'down',
      time: new Date().toISOString()
    };
  }
}

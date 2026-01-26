import { Controller, Get, Req, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { AllowQueryToken } from '../auth/auth.decorator';
import { resolveAdminToolsLocale } from '../../adminTools/i18n';
import { OpenApiSpecStore } from './openapi-spec.store';

// Serve the cached OpenAPI spec for docs and tooling. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
@ApiTags('OpenAPI')
@Controller('openapi.json')
export class OpenApiController {
  constructor(private readonly store: OpenApiSpecStore) {}

  @Get()
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Get OpenAPI spec for docs rendering.' })
  @ApiOkResponse({ description: 'OpenAPI JSON document.' })
  @AllowQueryToken()
  getSpec(@Req() req: Request) {
    // Resolve locale from query/header to return the best spec. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
    const locale = resolveAdminToolsLocale({
      queryLang: (req as any)?.query?.lang,
      acceptLanguage: req.header('accept-language'),
      fallback: 'en-US'
    });
    const spec = this.store.getSpec(locale);
    if (!spec) {
      throw new ServiceUnavailableException({ error: 'Service Unavailable', message: 'OpenAPI spec not ready.' });
    }
    return spec;
  }
}

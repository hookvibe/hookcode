import { Module } from '@nestjs/common';
import { OpenApiController } from './openapi.controller';
import { OpenApiSpecStore } from './openapi-spec.store';

// Expose the OpenAPI spec endpoint to the main API app. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
@Module({
  controllers: [OpenApiController],
  providers: [OpenApiSpecStore],
  exports: [OpenApiSpecStore]
})
export class OpenApiModule {}

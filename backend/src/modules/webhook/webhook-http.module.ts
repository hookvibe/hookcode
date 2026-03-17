import { Module } from '@nestjs/common';
import { WebhookEventsController } from './webhook-events.controller';
import { WebhookController } from './webhook.controller';
import { WebhookModule } from './webhook.module';
// Import RepositoriesModule so RepoAccessService is available to WebhookEventsController. docs/en/developer/plans/package-json-cross-platform-20260318/task_plan.md package-json-cross-platform-20260318
import { RepositoriesModule } from '../repositories/repositories.module';

@Module({
  imports: [WebhookModule, RepositoriesModule],
  controllers: [WebhookController, WebhookEventsController]
})
export class WebhookHttpModule {}

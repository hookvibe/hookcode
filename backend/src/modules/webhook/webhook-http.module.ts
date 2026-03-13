import { Module } from '@nestjs/common';
import { WebhookEventsController } from './webhook-events.controller';
import { WebhookController } from './webhook.controller';
import { WebhookModule } from './webhook.module';

@Module({
  imports: [WebhookModule],
  controllers: [WebhookController, WebhookEventsController]
})
export class WebhookHttpModule {}

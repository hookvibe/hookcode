import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { WebhookModule } from './webhook.module';

@Module({
  imports: [WebhookModule],
  controllers: [WebhookController]
})
export class WebhookHttpModule {}


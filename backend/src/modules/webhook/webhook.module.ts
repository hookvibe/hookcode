import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TasksModule } from '../tasks/tasks.module';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TasksModule, RepositoriesModule],
  providers: [WebhookService],
  exports: [WebhookService]
})
export class WebhookModule {}

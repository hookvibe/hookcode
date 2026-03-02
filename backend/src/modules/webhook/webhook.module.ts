import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TasksModule } from '../tasks/tasks.module';
import { LogsModule } from '../logs/logs.module';
import { WebhookService } from './webhook.service';

@Module({
  // Import LogsModule so webhook service can emit system logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  imports: [TasksModule, RepositoriesModule, LogsModule],
  providers: [WebhookService],
  exports: [WebhookService]
})
export class WebhookModule {}

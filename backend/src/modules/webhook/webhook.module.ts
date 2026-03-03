import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TasksModule } from '../tasks/tasks.module';
import { LogsModule } from '../logs/logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhookService } from './webhook.service';

@Module({
  // Import LogsModule so webhook service can emit system logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  // Import NotificationsModule so webhook tasks can resolve trigger users. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  imports: [TasksModule, RepositoriesModule, LogsModule, NotificationsModule],
  providers: [WebhookService],
  exports: [WebhookService]
})
export class WebhookModule {}

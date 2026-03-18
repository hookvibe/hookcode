import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { TasksModule } from '../tasks/tasks.module';
import { LogsModule } from '../logs/logs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { SkillsModule } from '../skills/skills.module';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookService } from './webhook.service';

@Module({
  // Import LogsModule so webhook service can emit system logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  // Import NotificationsModule so webhook tasks can resolve trigger users. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  // Import UsersModule and SkillsModule so replay dry runs can resolve caller credentials and repo skill prompts. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
  imports: [TasksModule, RepositoriesModule, LogsModule, NotificationsModule, UsersModule, SkillsModule],
  providers: [WebhookService, WebhookEventsService],
  exports: [WebhookService, WebhookEventsService]
})
export class WebhookModule {}

import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LogsModule } from '../logs/logs.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UsersModule } from '../users/users.module';
import { NotificationRecipientService } from './notification-recipient.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EventsModule, LogsModule, RepositoriesModule, UsersModule],
  providers: [NotificationsService, NotificationRecipientService],
  exports: [NotificationsService, NotificationRecipientService]
})
// Provide notification persistence and recipient resolution helpers. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export class NotificationsModule {}

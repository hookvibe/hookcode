import { Module } from '@nestjs/common';
import { NotificationsModule } from './notifications.module';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [NotificationsController]
})
// Wire notification HTTP endpoints for the console UI. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export class NotificationsHttpModule {}

import { Module } from '@nestjs/common';
import { LogsModule } from './logs.module';
import { LogsController } from './logs.controller';
import { RepositoriesModule } from '../repositories/repositories.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [LogsModule, RepositoriesModule, EventsModule],
  controllers: [LogsController]
})
// Wire system log HTTP endpoints for admin access. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export class LogsHttpModule {}

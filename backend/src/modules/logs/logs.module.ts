import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { LogsService } from './logs.service';
import { LogWriterService } from './log-writer.service';
import { AuditLogInterceptor } from './audit-log.interceptor';

@Module({
  imports: [EventsModule],
  providers: [LogsService, LogWriterService, AuditLogInterceptor],
  exports: [LogsService, LogWriterService, AuditLogInterceptor]
})
// Provide log persistence + audit helpers as reusable services. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export class LogsModule {}

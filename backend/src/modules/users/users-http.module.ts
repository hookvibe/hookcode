import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersModule } from './users.module';
import { LogsModule } from '../logs/logs.module'; // Provide log writer for user account logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

@Module({
  imports: [UsersModule, LogsModule], // Wire LogsModule for user audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  controllers: [UsersController]
})
export class UsersHttpModule {}

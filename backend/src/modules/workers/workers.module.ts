import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { WorkersService } from './workers.service';
import { WorkersConnectionService } from './workers-connection.service';
import { LocalWorkerSupervisorService } from './local-worker-supervisor.service';

@Module({
  imports: [LogsModule],
  providers: [WorkersService, WorkersConnectionService, LocalWorkerSupervisorService],
  exports: [WorkersService, WorkersConnectionService, LocalWorkerSupervisorService]
})
// Provide worker registry, websocket routing, and local supervisor helpers for task dispatch. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export class WorkersModule {}

import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { SkillsModule } from '../skills/skills.module';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { WorkersController } from './workers.controller';
import { WorkersInternalController } from './workers-internal.controller';
import { WorkersModule } from './workers.module';

@Module({
  imports: [WorkersModule, TasksModule, RepositoriesModule, UsersModule, SkillsModule],
  controllers: [WorkersController, WorkersInternalController]
})
// Wire admin worker APIs and internal worker-runtime APIs under the HTTP application. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307
export class WorkersHttpModule {}

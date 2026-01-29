import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesModule } from './repositories.module';
import { UsersModule } from '../users/users.module';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  // Include TasksModule to resolve preview config dependencies. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  imports: [RepositoriesModule, UsersModule, TasksModule],
  controllers: [RepositoriesController]
})
export class RepositoriesHttpModule {}

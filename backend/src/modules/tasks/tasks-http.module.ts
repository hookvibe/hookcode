import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ChatController } from './chat.controller';
import { DashboardController } from './dashboard.controller';
import { TaskGroupsController } from './task-groups.controller';
import { TasksController } from './tasks.controller';
import { TasksModule } from './tasks.module';

@Module({
  // ChatController depends on RepositoryService/RepoRobotService (from RepositoriesModule).
  // Change record: import RepositoriesModule here so Nest can resolve those dependencies in the HTTP module context.
  // Add dashboard aggregated APIs under the tasks HTTP module. 7bqwou6abx4ste96ikhv
  imports: [TasksModule, RepositoriesModule],
  controllers: [TasksController, TaskGroupsController, ChatController, DashboardController]
})
export class TasksHttpModule {}

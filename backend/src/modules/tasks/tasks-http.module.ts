import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ChatController } from './chat.controller';
import { TaskGroupsController } from './task-groups.controller';
import { TasksController } from './tasks.controller';
import { TasksModule } from './tasks.module';

@Module({
  // ChatController depends on RepositoryService/RepoRobotService (from RepositoriesModule).
  // Change record: import RepositoriesModule here so Nest can resolve those dependencies in the HTTP module context.
  imports: [TasksModule, RepositoriesModule],
  controllers: [TasksController, TaskGroupsController, ChatController]
})
export class TasksHttpModule {}

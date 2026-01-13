import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UsersModule } from '../users/users.module';
import { AgentService } from './agent.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';

@Module({
  imports: [RepositoriesModule, UsersModule],
  providers: [TaskService, TaskLogStream, AgentService, TaskRunner],
  exports: [TaskService, TaskLogStream, AgentService, TaskRunner]
})
export class TasksModule {}

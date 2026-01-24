import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UsersModule } from '../users/users.module';
import { AgentService } from './agent.service';
import { TaskGitPushService } from './task-git-push.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';

@Module({
  imports: [RepositoriesModule, UsersModule],
  // Register git push service for task-level push actions. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  providers: [TaskService, TaskLogStream, AgentService, TaskRunner, TaskGitPushService],
  exports: [TaskService, TaskLogStream, AgentService, TaskRunner, TaskGitPushService]
})
export class TasksModule {}

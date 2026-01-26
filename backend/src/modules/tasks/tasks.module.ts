import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UsersModule } from '../users/users.module';
import { SystemModule } from '../system/system.module';
import { AgentService } from './agent.service';
import { TaskGitPushService } from './task-git-push.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';

@Module({
  imports: [RepositoriesModule, UsersModule, SystemModule],
  // Register git push service for task-level push actions. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  providers: [
    TaskService,
    TaskLogStream,
    AgentService,
    TaskRunner,
    TaskGitPushService,
    // Provide `.hookcode.yml` parsing for dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    HookcodeConfigService
  ],
  exports: [TaskService, TaskLogStream, AgentService, TaskRunner, TaskGitPushService, HookcodeConfigService]
})
export class TasksModule {}

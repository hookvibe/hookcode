import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { UsersModule } from '../users/users.module';
import { SystemModule } from '../system/system.module';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { AgentService } from './agent.service';
import { TaskGitPushService } from './task-git-push.service';
import { TaskLogStream } from './task-log-stream.service';
import { TaskRunner } from './task-runner.service';
import { TaskService } from './task.service';
import { HookcodeConfigService } from '../../services/hookcodeConfigService';
import { PreviewService } from './preview.service';
import { PreviewLogStream } from './preview-log-stream.service';
import { PreviewWsProxyService } from './preview-ws-proxy.service';
import { PreviewHostProxyService } from './preview-host-proxy.service';
import { PreviewHighlightService } from './preview-highlight.service';

@Module({
  // Import AuthModule so PreviewWsProxyService can validate tokens. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  // Import EventsModule to publish preview highlight commands over SSE. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  imports: [RepositoriesModule, UsersModule, SystemModule, AuthModule, EventsModule],
  // Register git push service for task-level push actions. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj
  providers: [
    TaskService,
    TaskLogStream,
    // Provide preview log streaming for SSE clients. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    PreviewLogStream,
    // Register preview WS proxy service for HMR upgrades. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    PreviewWsProxyService,
    // Register preview host proxy for subdomain preview routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    PreviewHostProxyService,
    // Provide preview highlight command publishing for the frontend bridge. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    PreviewHighlightService,
    AgentService,
    TaskRunner,
    TaskGitPushService,
    // Provide `.hookcode.yml` parsing for dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    HookcodeConfigService,
    // Provide TaskGroup preview orchestration for dev servers. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    PreviewService
  ],
  exports: [
    TaskService,
    TaskLogStream,
    PreviewLogStream,
    // Export preview highlight publisher for HTTP controllers. docs/en/developer/plans/taskgrouppreviewdi20260201/task_plan.md taskgrouppreviewdi20260201
    PreviewHighlightService,
    AgentService,
    TaskRunner,
    TaskGitPushService,
    HookcodeConfigService,
    PreviewService
  ]
})
export class TasksModule {}

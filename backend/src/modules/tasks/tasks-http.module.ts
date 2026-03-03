import { Module } from '@nestjs/common';
import { LogsModule } from '../logs/logs.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ChatController } from './chat.controller';
import { DashboardController } from './dashboard.controller';
import { PreviewAdminController } from './preview-admin.controller';
import { PreviewProxyController } from './preview-proxy.controller';
import { TaskGroupsController } from './task-groups.controller';
import { TaskGroupPreviewController } from './task-group-preview.controller';
import { TasksController } from './tasks.controller';
import { TasksModule } from './tasks.module';
import { SkillsModule } from '../skills/skills.module';

@Module({
  // ChatController depends on RepositoryService/RepoRobotService (from RepositoriesModule).
  // Change record: import RepositoriesModule here so Nest can resolve those dependencies in the HTTP module context.
  // Add dashboard aggregated APIs under the tasks HTTP module. 7bqwou6abx4ste96ikhv
  // Import SkillsModule for task-group skill selection endpoints. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  // Import LogsModule so preview admin endpoints can emit audit entries. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
  imports: [TasksModule, RepositoriesModule, SkillsModule, LogsModule],
  // Wire preview HTTP controllers alongside task-group APIs. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  controllers: [
    TasksController,
    TaskGroupsController,
    TaskGroupPreviewController,
    PreviewProxyController,
    // Register admin preview overview APIs for cross-repo runtime management. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    PreviewAdminController,
    ChatController,
    DashboardController
  ]
})
export class TasksHttpModule {}

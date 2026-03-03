import { Module } from '@nestjs/common';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesModule } from './repositories.module';
import { UsersModule } from '../users/users.module';
import { TasksModule } from '../tasks/tasks.module';
import { SkillsModule } from '../skills/skills.module';
import { LogsModule } from '../logs/logs.module'; // Provide log writer for repo event logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302

@Module({
  // Include TasksModule to resolve preview config dependencies. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  // Import SkillsModule to serve repo-level skill defaults. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  imports: [RepositoriesModule, UsersModule, TasksModule, SkillsModule, LogsModule], // Wire LogsModule for repo audit logging. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  controllers: [RepositoriesController]
})
export class RepositoriesHttpModule {}

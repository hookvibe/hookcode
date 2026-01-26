import { Module } from '@nestjs/common';
import { AuthHttpModule } from './modules/auth/auth-http.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { GitProvidersModule } from './modules/git-providers/git-providers.module';
import { EventsHttpModule } from './modules/events/events-http.module';
import { HealthModule } from './modules/health/health.module';
import { RepositoriesHttpModule } from './modules/repositories/repositories-http.module';
import { SystemModule } from './modules/system/system.module';
import { TasksHttpModule } from './modules/tasks/tasks-http.module';
import { ToolsModule } from './modules/tools/tools.module';
import { UsersHttpModule } from './modules/users/users-http.module';
import { WebhookHttpModule } from './modules/webhook/webhook-http.module';

@Module({
  imports: [
    DatabaseModule,
    GitProvidersModule,
    AuthModule,
    AuthHttpModule,
    HealthModule,
    // Add a reusable SSE channel for push-based UI refresh (dashboard, etc.). kxthpiu4eqrmu0c6bboa
    EventsHttpModule,
    UsersHttpModule,
    RepositoriesHttpModule,
    TasksHttpModule,
    // Expose runtime detection APIs and services for dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    SystemModule,
    ToolsModule,
    WebhookHttpModule
  ]
})
export class AppModule {}

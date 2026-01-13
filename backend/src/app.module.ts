import { Module } from '@nestjs/common';
import { AuthHttpModule } from './modules/auth/auth-http.module';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './modules/database/database.module';
import { GitProvidersModule } from './modules/git-providers/git-providers.module';
import { HealthModule } from './modules/health/health.module';
import { RepositoriesHttpModule } from './modules/repositories/repositories-http.module';
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
    UsersHttpModule,
    RepositoriesHttpModule,
    TasksHttpModule,
    ToolsModule,
    WebhookHttpModule
  ]
})
export class AppModule {}

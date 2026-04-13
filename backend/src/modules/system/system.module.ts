import { Module } from '@nestjs/common';
import { RuntimeService } from '../../services/runtimeService';
import { LogsModule } from '../logs/logs.module';
import { RepositoriesModule } from '../repositories/repositories.module';
import { GlobalRobotsController } from './global-robots.controller';
import { SystemController } from './system.controller';

@Module({
  imports: [RepositoriesModule, LogsModule],
  // Provide runtime detection services for dependency installs and API exposure. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  controllers: [SystemController, GlobalRobotsController],
  providers: [RuntimeService],
  exports: [RuntimeService]
})
export class SystemModule {}

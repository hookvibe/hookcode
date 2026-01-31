import { Module } from '@nestjs/common';
import { RuntimeService } from '../../services/runtimeService';
import { SystemController } from './system.controller';

@Module({
  // Provide runtime detection services for dependency installs and API exposure. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  controllers: [SystemController],
  providers: [RuntimeService],
  exports: [RuntimeService]
})
export class SystemModule {}

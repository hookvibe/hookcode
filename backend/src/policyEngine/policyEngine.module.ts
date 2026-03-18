import { Module } from '@nestjs/common';
import { ApprovalQueueService } from './approvalQueue.service';
import { PolicyEngineService } from './policyEngine.service';

@Module({
  providers: [PolicyEngineService, ApprovalQueueService],
  exports: [PolicyEngineService, ApprovalQueueService]
})
export class PolicyEngineModule {}

import { Module } from '@nestjs/common';
import { RepoAutomationService } from './repo-automation.service';
import { RepoAccessService } from './repo-access.service';
import { RepoMemberService } from './repo-member.service';
import { RepoRobotService } from './repo-robot.service';
import { RepoWebhookDeliveryService } from './repo-webhook-delivery.service';
import { RepositoryService } from './repository.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  // Register repo RBAC + member invite services. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  providers: [RepositoryService, RepoRobotService, RepoAutomationService, RepoWebhookDeliveryService, RepoAccessService, RepoMemberService],
  exports: [RepositoryService, RepoRobotService, RepoAutomationService, RepoWebhookDeliveryService, RepoAccessService, RepoMemberService]
})
export class RepositoriesModule {}

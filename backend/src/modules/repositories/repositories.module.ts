import { Module } from '@nestjs/common';
import { RepoAutomationService } from './repo-automation.service';
import { RepoAccessService } from './repo-access.service';
import { RepoMemberService } from './repo-member.service';
import { RepoRobotService } from './repo-robot.service';
import { GlobalRobotService } from './global-robot.service';
import { GlobalCredentialService } from './global-credentials.service';
import { RobotCatalogService } from './robot-catalog.service';
import { RepoWebhookDeliveryService } from './repo-webhook-delivery.service';
import { RepositoryService } from './repository.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  // Register repo RBAC + member invite services. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  providers: [
    RepositoryService,
    RepoRobotService,
    // Provide globally shared robot and credential stores to repo/task/webhook consumers. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa
    GlobalRobotService,
    GlobalCredentialService,
    RobotCatalogService,
    RepoAutomationService,
    RepoWebhookDeliveryService,
    RepoAccessService,
    RepoMemberService
  ],
  exports: [
    RepositoryService,
    RepoRobotService,
    GlobalRobotService,
    GlobalCredentialService,
    RobotCatalogService,
    RepoAutomationService,
    RepoWebhookDeliveryService,
    RepoAccessService,
    RepoMemberService
  ]
})
export class RepositoriesModule {}

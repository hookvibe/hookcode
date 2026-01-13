import { Module } from '@nestjs/common';
import { RepoAutomationService } from './repo-automation.service';
import { RepoRobotService } from './repo-robot.service';
import { RepoWebhookDeliveryService } from './repo-webhook-delivery.service';
import { RepositoryService } from './repository.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [RepositoryService, RepoRobotService, RepoAutomationService, RepoWebhookDeliveryService],
  exports: [RepositoryService, RepoRobotService, RepoAutomationService, RepoWebhookDeliveryService]
})
export class RepositoriesModule {}

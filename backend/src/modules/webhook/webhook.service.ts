import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RepoAutomationService } from '../repositories/repo-automation.service';
import { RepoWebhookDeliveryService } from '../repositories/repo-webhook-delivery.service';
import { RepositoryService } from '../repositories/repository.service';
import { RobotCatalogService } from '../repositories/robot-catalog.service';
import { TaskRunner } from '../tasks/task-runner.service';
import { TaskService } from '../tasks/task.service';
import { LogWriterService } from '../logs/log-writer.service';
import { NotificationRecipientService } from '../notifications/notification-recipient.service';
import { handleGithubWebhook, handleGitlabWebhook } from './webhook.handlers';

@Injectable()
export class WebhookService {
  constructor(
    private readonly taskService: TaskService,
    private readonly taskRunner: TaskRunner,
    private readonly repositoryService: RepositoryService,
    private readonly robotCatalogService: RobotCatalogService,
    private readonly repoAutomationService: RepoAutomationService,
    private readonly repoWebhookDeliveryService: RepoWebhookDeliveryService,
    // Provide log writer so webhook handlers emit system logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
    private readonly logWriter: LogWriterService,
    // Provide notification recipient resolver for trigger attribution. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    private readonly notificationRecipients: NotificationRecipientService
  ) {}

  handleGitlabWebhook(req: Request, res: Response) {
    return handleGitlabWebhook(req, res, {
      taskService: this.taskService,
      taskRunner: this.taskRunner,
      repositoryService: this.repositoryService,
      robotCatalogService: this.robotCatalogService,
      repoAutomationService: this.repoAutomationService,
      repoWebhookDeliveryService: this.repoWebhookDeliveryService,
      logWriter: this.logWriter,
      notificationRecipients: this.notificationRecipients
    });
  }

  handleGithubWebhook(req: Request, res: Response) {
    return handleGithubWebhook(req, res, {
      taskService: this.taskService,
      taskRunner: this.taskRunner,
      repositoryService: this.repositoryService,
      robotCatalogService: this.robotCatalogService,
      repoAutomationService: this.repoAutomationService,
      repoWebhookDeliveryService: this.repoWebhookDeliveryService,
      logWriter: this.logWriter,
      notificationRecipients: this.notificationRecipients
    });
  }
}

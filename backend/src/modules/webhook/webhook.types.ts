import type { TaskService } from '../tasks/task.service';
import type { TaskRunner } from '../tasks/task-runner.service';
import type { RepositoryService } from '../repositories/repository.service';
import type { RepoRobotService } from '../repositories/repo-robot.service';
import type { RepoAutomationService } from '../repositories/repo-automation.service';
import type { RepoWebhookDeliveryService } from '../repositories/repo-webhook-delivery.service';
import type { TaskEventType } from '../../types/task';
import type { LogWriterService } from '../logs/log-writer.service';
import type { NotificationRecipientService } from '../notifications/notification-recipient.service';

// Split webhook shared types into a dedicated module for cleaner imports. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export interface WebhookDeps {
  taskService: TaskService;
  taskRunner: TaskRunner;
  repositoryService: RepositoryService;
  repoRobotService: RepoRobotService;
  repoAutomationService: RepoAutomationService;
  repoWebhookDeliveryService: RepoWebhookDeliveryService;
  // Include log writer so webhook handlers can emit system logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
  logWriter: LogWriterService;
  // Resolve trigger users for notification routing. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
  notificationRecipients: NotificationRecipientService;
}

/**
 * Automation config (new system) event mapping:
 * - Covers: issue / commit / merge_request
 * - Can be extended with more events later
 */
export type AutomationEventMapping = { eventType: TaskEventType; subType: string };

export interface CreateGuardResult {
  allowed: boolean;
  reason?: string;
}

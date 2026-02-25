import type { TaskService } from '../tasks/task.service';
import type { TaskRunner } from '../tasks/task-runner.service';
import type { RepositoryService } from '../repositories/repository.service';
import type { RepoRobotService } from '../repositories/repo-robot.service';
import type { RepoAutomationService } from '../repositories/repo-automation.service';
import type { RepoWebhookDeliveryService } from '../repositories/repo-webhook-delivery.service';
import type { TaskEventType } from '../../types/task';

// Split webhook shared types into a dedicated module for cleaner imports. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export interface WebhookDeps {
  taskService: TaskService;
  taskRunner: TaskRunner;
  repositoryService: RepositoryService;
  repoRobotService: RepoRobotService;
  repoAutomationService: RepoAutomationService;
  repoWebhookDeliveryService: RepoWebhookDeliveryService;
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

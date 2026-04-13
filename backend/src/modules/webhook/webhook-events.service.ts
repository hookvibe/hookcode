import { Injectable, NotFoundException } from '@nestjs/common';
import { RepoWebhookDeliveryService, type RepoWebhookDeliveryDetail, type GlobalWebhookEventListOptions } from '../repositories/repo-webhook-delivery.service';
import { GlobalCredentialService } from '../repositories/global-credentials.service';
import { RepositoryService } from '../repositories/repository.service';
import { RepoAutomationService } from '../repositories/repo-automation.service';
import { RobotCatalogService } from '../repositories/robot-catalog.service';
import { UserService } from '../users/user.service';
import { SkillsService } from '../skills/skills.service';
import { TaskService } from '../tasks/task.service';
import { TaskRunner } from '../tasks/task-runner.service';
import { LogWriterService } from '../logs/log-writer.service';
import { executeWebhookAutomation, type WebhookReplaySelection } from './webhook.execution';
import { WebhookTraceRecorder, hashWebhookPayload, type WebhookReplayMode } from './webhook-debug';

export interface ReplayWebhookEventInput {
  mode?: WebhookReplayMode;
  robotId?: string;
  ruleId?: string;
}

const coerceReplayMode = (value: unknown, fallback: WebhookReplayMode, overrides?: { robotId?: string; ruleId?: string }): WebhookReplayMode => {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (raw === 'current_config' || raw === 'override_robot' || raw === 'override_rule') return raw;
  if (safeTrim(overrides?.ruleId)) return 'override_rule';
  if (safeTrim(overrides?.robotId)) return 'override_robot';
  return fallback;
};

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const extractStoredActions = (event: RepoWebhookDeliveryDetail): WebhookReplaySelection['storedActions'] => {
  const actions = (event.debugTrace as any)?.resolvedActions;
  return Array.isArray(actions) ? actions : [];
};

// Centralize admin/repo replay flows so live ingress and replay share one execution path and event schema. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
@Injectable()
export class WebhookEventsService {
  constructor(
    private readonly repoWebhookDeliveryService: RepoWebhookDeliveryService,
    private readonly repositoryService: RepositoryService,
    private readonly robotCatalogService: RobotCatalogService,
    private readonly repoAutomationService: RepoAutomationService,
    private readonly globalCredentialService: GlobalCredentialService,
    private readonly userService: UserService,
    private readonly skillsService: SkillsService,
    private readonly taskService: TaskService,
    private readonly taskRunner: TaskRunner,
    private readonly logWriter: LogWriterService
  ) {}

  async listGlobalEvents(options?: GlobalWebhookEventListOptions) {
    return this.repoWebhookDeliveryService.listGlobalEvents(options);
  }

  async getEvent(eventId: string): Promise<RepoWebhookDeliveryDetail> {
    const event = await this.repoWebhookDeliveryService.getDeliveryById(eventId);
    if (!event) throw new NotFoundException({ error: 'Webhook event not found' });
    return event;
  }

  async replayEvent(eventId: string, actorUserId: string, input?: ReplayWebhookEventInput, options?: { dryRun?: boolean }): Promise<RepoWebhookDeliveryDetail> {
    const sourceEvent = await this.getEvent(eventId);
    const repo = await this.repositoryService.getById(sourceEvent.repoId);
    if (!repo) throw new NotFoundException({ error: 'Repo not found' });

    const dryRun = Boolean(options?.dryRun);
    const fallbackMode: WebhookReplayMode = sourceEvent.matchedRobotIds.length ? 'stored_actions' : 'current_config';
    const mode = coerceReplayMode(input?.mode, fallbackMode, input);
    const selection: WebhookReplaySelection = {
      mode,
      robotId: safeTrim(input?.robotId) || undefined,
      ruleId: safeTrim(input?.ruleId) || undefined,
      storedActions: extractStoredActions(sourceEvent)
    };
    const trace = new WebhookTraceRecorder({
      source: 'replay',
      provider: sourceEvent.provider,
      eventName: sourceEvent.eventName,
      replayOfEventId: sourceEvent.id,
      replayMode: mode
    });
    trace.addStep({ key: 'source', title: 'Source webhook event loaded', status: 'success', message: `Loaded source event ${sourceEvent.id}.` });

    if (!dryRun && repo.archivedAt) {
      trace.addStep({ key: 'repo-state', title: 'Repository state checked', status: 'failed', message: 'Repository is archived; replay cannot enqueue tasks.' });
      const stored = await this.repoWebhookDeliveryService.createDelivery({
        repoId: repo.id,
        provider: sourceEvent.provider,
        eventName: sourceEvent.eventName ?? null,
        mappedEventType: sourceEvent.mappedEventType ?? null,
        result: 'skipped',
        httpStatus: 202,
        code: 'REPO_ARCHIVED',
        message: 'repo archived',
        payloadHash: hashWebhookPayload(sourceEvent.payload),
        errorLayer: 'repo_state',
        matchedRuleIds: [],
        matchedRobotIds: [],
        taskIds: [],
        taskGroupIds: [],
        replayOfEventId: sourceEvent.id,
        replayMode: mode,
        payload: sourceEvent.payload,
        response: { skipped: true, reason: 'repo archived' },
        debugTrace: trace.snapshot()
      });
      return (await this.repoWebhookDeliveryService.getDeliveryById(stored.id)) ?? sourceEvent;
    }

    if (!dryRun && !repo.enabled) {
      trace.addStep({ key: 'repo-state', title: 'Repository state checked', status: 'failed', message: 'Repository is disabled; replay cannot enqueue tasks.' });
      const stored = await this.repoWebhookDeliveryService.createDelivery({
        repoId: repo.id,
        provider: sourceEvent.provider,
        eventName: sourceEvent.eventName ?? null,
        mappedEventType: sourceEvent.mappedEventType ?? null,
        result: 'skipped',
        httpStatus: 202,
        code: 'REPO_DISABLED',
        message: 'repo disabled',
        payloadHash: hashWebhookPayload(sourceEvent.payload),
        errorLayer: 'repo_state',
        matchedRuleIds: [],
        matchedRobotIds: [],
        taskIds: [],
        taskGroupIds: [],
        replayOfEventId: sourceEvent.id,
        replayMode: mode,
        payload: sourceEvent.payload,
        response: { skipped: true, reason: 'repo disabled' },
        debugTrace: trace.snapshot()
      });
      return (await this.repoWebhookDeliveryService.getDeliveryById(stored.id)) ?? sourceEvent;
    }

    const repoScopedCredentials = await this.repositoryService.getRepoScopedCredentials(repo.id);
    const userCredentials = await this.userService.getModelCredentialsRaw(actorUserId);
    const globalCredentials = await this.globalCredentialService.getCredentialsRaw();
    const skillPromptPrefix = await this.skillsService.buildPromptPrefix(Array.isArray(repo.skillDefaults) ? repo.skillDefaults : null);

    const execution = await executeWebhookAutomation(
      {
        taskService: this.taskService,
        robotCatalogService: this.robotCatalogService,
        repoAutomationService: this.repoAutomationService
      },
      {
        provider: sourceEvent.provider,
        repo,
        eventName: sourceEvent.eventName ?? '',
        payload: sourceEvent.payload ?? {},
        actorUserId,
        dryRun,
        trace,
        selection,
        dryRunContext: dryRun
          ? {
              userCredentials,
              globalCredentials,
              repoScopedCredentials: repoScopedCredentials?.modelProvider ?? null,
              skillPromptPrefix
            }
          : undefined
      }
    );

    if (!dryRun && execution.result === 'accepted') {
      this.taskRunner.trigger().catch((err) => console.error('[webhook] replay trigger task runner failed', err));
    }

    const responseBody = dryRun
      ? { dryRun: execution.dryRunResult }
      : execution.result === 'accepted'
        ? { tasks: execution.createdTasks }
        : { skipped: true, reason: execution.message };
    const httpStatus = dryRun ? 200 : execution.result === 'accepted' ? 202 : 202;
    const created = await this.repoWebhookDeliveryService.createDelivery({
      repoId: repo.id,
      provider: sourceEvent.provider,
      eventName: sourceEvent.eventName ?? null,
      mappedEventType: execution.mappedEventType ?? sourceEvent.mappedEventType ?? null,
      result: dryRun ? 'accepted' : execution.result,
      httpStatus,
      code: execution.code ?? null,
      message: execution.message ?? null,
      payloadHash: hashWebhookPayload(sourceEvent.payload),
      errorLayer: dryRun ? 'dry_run' : execution.errorLayer ?? null,
      matchedRuleIds: execution.matchedRuleIds,
      matchedRobotIds: execution.matchedRobotIds,
      taskIds: execution.taskIds,
      taskGroupIds: execution.taskGroupIds,
      replayOfEventId: sourceEvent.id,
      replayMode: mode,
      payload: sourceEvent.payload,
      response: responseBody,
      debugTrace: trace.snapshot(),
      dryRunResult: execution.dryRunResult
    });

    // Emit explicit audit logs for replay invocations so admin history can attribute user-triggered reprocessing. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
    void this.logWriter.logOperation({
      level: execution.result === 'accepted' ? 'info' : 'warn',
      actorUserId,
      repoId: repo.id,
      message: dryRun ? 'Webhook replay dry run executed.' : 'Webhook replay executed.',
      code: dryRun ? 'WEBHOOK_REPLAY_DRY_RUN' : 'WEBHOOK_REPLAY',
      meta: {
        eventId: created.id,
        replayOfEventId: sourceEvent.id,
        replayMode: mode,
        matchedRuleIds: execution.matchedRuleIds,
        matchedRobotIds: execution.matchedRobotIds,
        taskIds: execution.taskIds
      }
    });

    return (await this.repoWebhookDeliveryService.getDeliveryById(created.id)) ?? sourceEvent;
  }
}

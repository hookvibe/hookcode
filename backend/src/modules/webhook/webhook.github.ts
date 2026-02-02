import type { Request, Response } from 'express';
import { buildRepoHydrationPatch } from '../../services/repoHydration';
import { resolveAutomationActions } from '../../services/automationEngine';
import { attachTaskSchedule, isTimeWindowActive, resolveTaskSchedule } from '../../utils/timeWindow';
import type { WebhookDeps } from './webhook.types';
import { mapGithubAutomationEvent } from './webhook.automation';
import { canCreateGithubAutomationTask, isInlineWorkerEnabled } from './webhook.guard';
import { buildGithubTaskMeta } from './webhook.meta';
import { recordWebhookDeliveryBestEffort } from './webhook.delivery';
import {
  detectWebhookProviderMismatch,
  safeString,
  validateRepoWebhookBinding,
  validateRepoWebhookNameBinding,
  verifyGithubSecret
} from './webhook.validation';

// Split GitHub webhook handler into a provider-specific module for maintainability. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const handleGithubWebhook = async (req: Request, res: Response, deps: WebhookDeps) => {
  const { taskService, taskRunner, repositoryService, repoRobotService, repoAutomationService, repoWebhookDeliveryService } = deps;
  const repoId = String(req.params.repoId ?? '').trim();
  const eventName = safeString(req.header('x-github-event') ?? '').trim();
  const deliveryId = safeString(req.header('x-github-delivery') ?? '').trim();
  const basePayload = req.body;

  let canRecord = false;
  const respond = async (
    httpStatus: number,
    body: any,
    meta: { result: 'accepted' | 'skipped' | 'rejected' | 'error'; code?: string; message?: string; taskIds?: string[] }
  ) => {
    if (canRecord) {
      await recordWebhookDeliveryBestEffort(repoWebhookDeliveryService, {
        repoId,
        provider: 'github',
        eventName,
        deliveryId,
        payload: basePayload,
        httpStatus,
        result: meta.result,
        code: meta.code,
        message: meta.message,
        taskIds: meta.taskIds,
        response: body
      });
    }
    return res.status(httpStatus).json(body);
  };

  try {
    const repoAuth = await repositoryService.getByIdWithSecret(repoId);
    if (!repoAuth) return res.status(404).json({ error: 'Repo not found' });
    canRecord = true;

    // Do not accept events for archived repos to keep the Archive area stable. qnp1mtxhzikhbi0xspbc
    if (repoAuth.repo.archivedAt) {
      return respond(202, { skipped: true, reason: 'repo archived' }, { result: 'skipped', message: 'repo archived' });
    }
    if (!repoAuth.repo.enabled) {
      return respond(202, { skipped: true, reason: 'repo disabled' }, { result: 'skipped', message: 'repo disabled' });
    }
    if (repoAuth.repo.provider !== 'github') {
      return respond(400, { error: 'Repo provider mismatch' }, { result: 'rejected', message: 'Repo provider mismatch' });
    }

    // Webhook ingress guard: block GitLab-delivered requests hitting the GitHub endpoint with a clear provider hint. (Change record: 2026-01-15)
    const providerMismatch = detectWebhookProviderMismatch('github', req, eventName);
    if (providerMismatch) {
      return respond(
        400,
        {
          error: 'Webhook provider mismatch',
          code: 'WEBHOOK_PROVIDER_MISMATCH',
          expectedProvider: providerMismatch.expectedProvider,
          detectedProvider: providerMismatch.detectedProvider,
          hint: providerMismatch.hint
        },
        { result: 'rejected', code: 'WEBHOOK_PROVIDER_MISMATCH', message: providerMismatch.message }
      );
    }

    const verify = verifyGithubSecret(req, repoAuth.webhookSecret);
    if (!verify.ok) {
      return respond(401, { error: 'Unauthorized', reason: verify.reason }, { result: 'rejected', code: 'UNAUTHORIZED', message: verify.reason });
    }

    const nameBinding = validateRepoWebhookNameBinding('github', repoAuth.repo, req.body);
    if (!nameBinding.ok) {
      const code = safeString(nameBinding.body?.code ?? '').trim() || undefined;
      const message = safeString(nameBinding.body?.error ?? '').trim() || safeString(nameBinding.body?.reason ?? '').trim() || undefined;
      return respond(nameBinding.status, nameBinding.body, { result: 'rejected', code, message });
    }

    const binding = validateRepoWebhookBinding('github', repoAuth.repo, req.body);
    if (!binding.ok) {
      const code = safeString(binding.body?.code ?? '').trim() || undefined;
      const message = safeString(binding.body?.error ?? '').trim() || safeString(binding.body?.reason ?? '').trim() || undefined;
      return respond(binding.status, binding.body, { result: 'rejected', code, message });
    }

    // Before marking verified, ensure repo identity is persisted (bind-on-first-delivery).
    const patch = buildRepoHydrationPatch('github', repoAuth.repo, req.body);
    if (Object.keys(patch).length) {
      try {
        await repositoryService.updateRepository(repoId, patch);
      } catch (err) {
        const mustBind = Boolean(patch.externalId || patch.apiBaseUrl);
        if (mustBind) {
          console.error('[webhook] hydrate repo identity failed', err);
          return respond(
            409,
            { error: 'Failed to bind webhook to repository identity', code: 'WEBHOOK_BIND_FAILED' },
            { result: 'rejected', code: 'WEBHOOK_BIND_FAILED', message: 'Failed to bind webhook to repository identity' }
          );
        }
        console.warn('[webhook] hydrate repo config failed (ignored)', err);
      }
    }

    await repositoryService.markWebhookVerified(repoId);

    const robots = (await repoRobotService.listByRepo(repoId)).filter((r) => r.enabled);
    if (!robots.length) {
      return respond(202, { skipped: true, reason: 'no enabled robot configured' }, { result: 'skipped', message: 'no enabled robot configured' });
    }

    const mapped = mapGithubAutomationEvent(eventName, req.body);
    if (!mapped) {
      return respond(202, { skipped: true, reason: 'event not supported' }, { result: 'skipped', message: 'event not supported' });
    }
    const eventType = mapped.eventType;
    const payload = { ...req.body, __subType: mapped.subType };

    const { allowed, reason } = canCreateGithubAutomationTask(eventType, payload, robots);
    console.log('[webhook] github repo', repoId, 'event', eventType, 'allowed:', allowed, reason ? `reason: ${reason}` : '');
    if (!allowed) {
      return respond(202, { skipped: true, reason }, { result: 'skipped', message: reason });
    }

    const automationConfig = await repoAutomationService.getConfig(repoId);
    const actions = resolveAutomationActions({
      eventType,
      payload,
      robots,
      config: automationConfig,
      repo: repoAuth.repo
    });
    if (!actions.length) {
      return respond(202, { skipped: true, reason: 'no automation rule matched' }, { result: 'skipped', message: 'no automation rule matched' });
    }

    const baseMeta = buildGithubTaskMeta(eventType, payload);
    const created: Array<{ id: string; robotId: string }> = [];

    for (const action of actions) {
      const robot = robots.find((r) => r.id === action.robotId);
      const title = baseMeta.title
        ? `${baseMeta.title} · ${robot?.name ?? action.robotId}`
        : robot?.name
          ? `${robot.name} · ${eventType}`
          : undefined;

      // Resolve trigger/robot time windows and skip duplicate queued tasks while waiting. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const schedule = resolveTaskSchedule({
        triggerWindow: action.timeWindow ?? null,
        robotWindow: robot?.timeWindow ?? null,
        ruleId: action.ruleId
      });
      const scheduleActive = schedule ? isTimeWindowActive(schedule.window) : true;
      if (schedule && schedule.source === 'trigger' && !scheduleActive) {
        const alreadyQueued = await taskService.hasQueuedTaskForRule({
          repoId,
          robotId: action.robotId,
          ruleId: schedule.ruleId ?? action.ruleId
        });
        if (alreadyQueued) continue;
      }

      const task = await taskService.createTask(eventType, attachTaskSchedule(payload, schedule), {
        ...baseMeta,
        title,
        repoId,
        repoProvider: 'github',
        robotId: action.robotId,
        promptCustom: action.promptCustom ?? null
      });
      created.push({ id: task.id, robotId: action.robotId });
    }

    if (isInlineWorkerEnabled()) {
      taskRunner.trigger().catch((err) => console.error('[webhook] trigger task runner failed', err));
    }
    return respond(202, { tasks: created }, { result: 'accepted', taskIds: created.map((t) => t.id), message: 'tasks created' });
  } catch (err) {
    console.error('[webhook] github repo failed to create task', err);
    const message = err instanceof Error ? err.message : String(err);
    return respond(500, { error: 'Failed to enqueue task' }, { result: 'error', code: 'INTERNAL_ERROR', message });
  }
};

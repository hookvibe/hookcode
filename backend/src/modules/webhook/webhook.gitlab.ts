import type { Request, Response } from 'express';
import { buildRepoHydrationPatch } from '../../services/repoHydration';
import { recordWebhookDeliveryBestEffort } from './webhook.delivery';
import { executeWebhookAutomation } from './webhook.execution';
import { WebhookTraceRecorder, hashWebhookPayload, type WebhookErrorLayer } from './webhook-debug';
import type { WebhookDeps } from './webhook.types';
import {
  detectWebhookProviderMismatch,
  safeString,
  validateRepoWebhookBinding,
  validateRepoWebhookNameBinding,
  verifyGitlabSecret
} from './webhook.validation';

// Keep GitLab webhook ingress aligned with replay/debug execution by delegating shared automation flow. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const handleGitlabWebhook = async (req: Request, res: Response, deps: WebhookDeps) => {
  const { taskService, repositoryService, robotCatalogService, repoAutomationService, repoWebhookDeliveryService, logWriter, notificationRecipients } = deps;
  const repoId = String(req.params.repoId ?? '').trim();
  const eventName = safeString(req.header('x-gitlab-event') ?? '').trim();
  const deliveryId = safeString(req.header('x-gitlab-event-uuid') ?? req.header('X-Gitlab-Event-UUID') ?? '').trim();
  const basePayload = req.body;
  const payloadHash = hashWebhookPayload(basePayload);
  const trace = new WebhookTraceRecorder({ source: 'ingress', provider: 'gitlab', eventName });

  let canRecord = false;
  let mappedEventType: string | undefined;
  let signatureVerified: boolean | undefined;
  let errorLayer: WebhookErrorLayer | undefined;
  let matchedRuleIds: string[] = [];
  let matchedRobotIds: string[] = [];
  let taskIds: string[] = [];
  let taskGroupIds: string[] = [];

  const respond = async (
    httpStatus: number,
    body: any,
    meta: {
      result: 'accepted' | 'skipped' | 'rejected' | 'error';
      code?: string;
      message?: string;
      errorLayer?: WebhookErrorLayer;
      mappedEventType?: string;
      matchedRuleIds?: string[];
      matchedRobotIds?: string[];
      taskIds?: string[];
      taskGroupIds?: string[];
    }
  ) => {
    if (meta.mappedEventType) mappedEventType = meta.mappedEventType;
    if (meta.errorLayer) errorLayer = meta.errorLayer;
    if (meta.matchedRuleIds) matchedRuleIds = meta.matchedRuleIds;
    if (meta.matchedRobotIds) matchedRobotIds = meta.matchedRobotIds;
    if (meta.taskIds) taskIds = meta.taskIds;
    if (meta.taskGroupIds) taskGroupIds = meta.taskGroupIds;

    if (canRecord) {
      await recordWebhookDeliveryBestEffort(repoWebhookDeliveryService, {
        repoId,
        provider: 'gitlab',
        eventName,
        mappedEventType,
        deliveryId,
        payload: basePayload,
        payloadHash,
        httpStatus,
        result: meta.result,
        code: meta.code,
        message: meta.message,
        signatureVerified,
        errorLayer,
        matchedRuleIds,
        matchedRobotIds,
        taskIds,
        taskGroupIds,
        response: body,
        debugTrace: trace.snapshot()
      });
    }
    if (meta.result === 'rejected' || meta.result === 'error') {
      // Emit system log entries for webhook rejections/errors. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
      void logWriter.logSystem({
        level: meta.result === 'error' ? 'error' : 'warn',
        message: meta.message ? `Webhook rejected: ${meta.message}` : 'Webhook rejected',
        code: meta.code ?? (meta.result === 'error' ? 'WEBHOOK_ERROR' : 'WEBHOOK_REJECTED'),
        repoId,
        meta: { provider: 'gitlab', eventName, deliveryId, httpStatus, result: meta.result, errorLayer }
      });
    }
    return res.status(httpStatus).json(body);
  };

  try {
    const repoAuth = await repositoryService.getByIdWithSecret(repoId);
    if (!repoAuth) return res.status(404).json({ error: 'Repo not found' });
    canRecord = true;
    trace.addStep({ key: 'repo', title: 'Repository loaded', status: 'success', message: 'Repository found for webhook request.' });

    // Do not accept events for archived repos to keep the Archive area stable. qnp1mtxhzikhbi0xspbc
    if (repoAuth.repo.archivedAt) {
      trace.addStep({ key: 'repo-state', title: 'Repository state checked', status: 'failed', message: 'Repository is archived.' });
      return respond(202, { skipped: true, reason: 'repo archived' }, { result: 'skipped', message: 'repo archived', errorLayer: 'repo_state' });
    }
    if (!repoAuth.repo.enabled) {
      trace.addStep({ key: 'repo-state', title: 'Repository state checked', status: 'failed', message: 'Repository is disabled.' });
      return respond(202, { skipped: true, reason: 'repo disabled' }, { result: 'skipped', message: 'repo disabled', errorLayer: 'repo_state' });
    }
    if (repoAuth.repo.provider !== 'gitlab') {
      trace.addStep({ key: 'provider', title: 'Repository provider checked', status: 'failed', message: 'Repository provider does not match GitLab.' });
      return respond(400, { error: 'Repo provider mismatch' }, { result: 'rejected', message: 'Repo provider mismatch', errorLayer: 'provider_mismatch' });
    }

    if (eventName && /^system hook$/i.test(eventName)) {
      trace.addStep({
        key: 'scope',
        title: 'Webhook scope checked',
        status: 'failed',
        code: 'WEBHOOK_SCOPE_NOT_SUPPORTED',
        message: 'System hooks are not supported.'
      });
      return respond(
        400,
        { error: 'System hooks are not supported; please configure a project webhook', code: 'WEBHOOK_SCOPE_NOT_SUPPORTED' },
        { result: 'rejected', code: 'WEBHOOK_SCOPE_NOT_SUPPORTED', message: 'system hook not supported', errorLayer: 'scope_validation' }
      );
    }

    const providerMismatch = detectWebhookProviderMismatch('gitlab', req, eventName);
    if (providerMismatch) {
      trace.addStep({
        key: 'provider',
        title: 'Webhook provider checked',
        status: 'failed',
        code: 'WEBHOOK_PROVIDER_MISMATCH',
        message: providerMismatch.message
      });
      return respond(
        400,
        {
          error: 'Webhook provider mismatch',
          code: 'WEBHOOK_PROVIDER_MISMATCH',
          expectedProvider: providerMismatch.expectedProvider,
          detectedProvider: providerMismatch.detectedProvider,
          hint: providerMismatch.hint
        },
        { result: 'rejected', code: 'WEBHOOK_PROVIDER_MISMATCH', message: providerMismatch.message, errorLayer: 'provider_mismatch' }
      );
    }

    const verify = verifyGitlabSecret(req, repoAuth.webhookSecret);
    signatureVerified = verify.ok;
    trace.addStep({
      key: 'signature',
      title: 'Webhook signature verified',
      status: verify.ok ? 'success' : 'failed',
      message: verify.ok ? 'Webhook secret verified.' : verify.reason
    });
    if (!verify.ok) {
      return respond(401, { error: 'Unauthorized', reason: verify.reason }, { result: 'rejected', code: 'UNAUTHORIZED', message: verify.reason, errorLayer: 'signature_validation' });
    }

    const nameBinding = validateRepoWebhookNameBinding('gitlab', repoAuth.repo, req.body);
    if (!nameBinding.ok) {
      const code = safeString(nameBinding.body?.code ?? '').trim() || undefined;
      const message = safeString(nameBinding.body?.error ?? '').trim() || safeString(nameBinding.body?.reason ?? '').trim() || undefined;
      trace.addStep({ key: 'name-binding', title: 'Repository name binding validated', status: 'failed', code, message });
      return respond(nameBinding.status, nameBinding.body, { result: 'rejected', code, message, errorLayer: 'name_binding' });
    }
    trace.addStep({ key: 'name-binding', title: 'Repository name binding validated', status: 'success', message: 'Repository name binding matched.' });

    const binding = validateRepoWebhookBinding('gitlab', repoAuth.repo, req.body);
    if (!binding.ok) {
      const code = safeString(binding.body?.code ?? '').trim() || undefined;
      const message = safeString(binding.body?.error ?? '').trim() || safeString(binding.body?.reason ?? '').trim() || undefined;
      trace.addStep({ key: 'repo-binding', title: 'Repository binding validated', status: 'failed', code, message });
      return respond(binding.status, binding.body, { result: 'rejected', code, message, errorLayer: 'repo_binding' });
    }
    trace.addStep({ key: 'repo-binding', title: 'Repository binding validated', status: 'success', message: 'Webhook payload matched repository identity.' });

    const patch = buildRepoHydrationPatch('gitlab', repoAuth.repo, req.body);
    if (Object.keys(patch).length) {
      try {
        await repositoryService.updateRepository(repoId, patch);
        trace.addStep({ key: 'hydrate', title: 'Repository identity hydrated', status: 'success', message: 'Repository identity fields were refreshed from webhook payload.' });
      } catch (err) {
        const mustBind = Boolean(patch.externalId || patch.apiBaseUrl);
        if (mustBind) {
          console.error('[webhook] hydrate repo identity failed', err);
          trace.addStep({
            key: 'hydrate',
            title: 'Repository identity hydrated',
            status: 'failed',
            code: 'WEBHOOK_BIND_FAILED',
            message: 'Failed to bind webhook to repository identity.'
          });
          return respond(
            409,
            { error: 'Failed to bind webhook to repository identity', code: 'WEBHOOK_BIND_FAILED' },
            { result: 'rejected', code: 'WEBHOOK_BIND_FAILED', message: 'Failed to bind webhook to repository identity', errorLayer: 'repo_binding' }
          );
        }
        console.warn('[webhook] hydrate repo config failed (ignored)', err);
        trace.addStep({ key: 'hydrate', title: 'Repository identity hydrated', status: 'skipped', message: 'Non-critical repository hydration failed and was ignored.' });
      }
    } else {
      trace.addStep({ key: 'hydrate', title: 'Repository identity hydrated', status: 'skipped', message: 'Repository identity was already up to date.' });
    }

    await repositoryService.markWebhookVerified(repoId);
    trace.addStep({ key: 'verified', title: 'Repository webhook marked verified', status: 'success', message: 'Repository webhook verification timestamp updated.' });

    const actorUserId = (await notificationRecipients.resolveActorUserIdFromPayload(repoId, basePayload)) ?? undefined;
    const execution = await executeWebhookAutomation(
      { taskService, robotCatalogService, repoAutomationService },
      {
        provider: 'gitlab',
        repo: repoAuth.repo,
        eventName,
        payload: basePayload,
        actorUserId,
        trace,
        selection: { mode: 'current_config' }
      }
    );

    if (execution.result === 'accepted') {
      return respond(202, { tasks: execution.createdTasks }, {
        result: 'accepted',
        message: execution.message,
        mappedEventType: execution.mappedEventType,
        matchedRuleIds: execution.matchedRuleIds,
        matchedRobotIds: execution.matchedRobotIds,
        taskIds: execution.taskIds,
        taskGroupIds: execution.taskGroupIds
      });
    }

    return respond(
      202,
      { skipped: true, reason: execution.message ?? 'Webhook event skipped' },
      {
        result: 'skipped',
        code: execution.code,
        message: execution.message,
        errorLayer: execution.errorLayer,
        mappedEventType: execution.mappedEventType,
        matchedRuleIds: execution.matchedRuleIds,
        matchedRobotIds: execution.matchedRobotIds,
        taskIds: execution.taskIds,
        taskGroupIds: execution.taskGroupIds
      }
    );
  } catch (err) {
    console.error('[webhook] gitlab repo failed to create task', err);
    const message = err instanceof Error ? err.message : String(err);
    trace.addStep({ key: 'internal', title: 'Webhook processing completed', status: 'failed', code: 'INTERNAL_ERROR', message });
    return respond(500, { error: 'Failed to enqueue task' }, { result: 'error', code: 'INTERNAL_ERROR', message, errorLayer: 'internal' });
  }
};

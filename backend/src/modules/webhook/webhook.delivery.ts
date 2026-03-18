import type { RepoWebhookDeliveryService } from '../repositories/repo-webhook-delivery.service';
import type { RepoProvider } from '../../types/repository';
import type { WebhookDebugTrace, WebhookDryRunResult, WebhookErrorLayer, WebhookReplayMode } from './webhook-debug';

// Split webhook delivery recording into a dedicated module for reuse. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const recordWebhookDeliveryBestEffort = async (
  repoWebhookDeliveryService: RepoWebhookDeliveryService,
  input: {
    repoId: string;
    provider: RepoProvider;
    eventName?: string;
    mappedEventType?: string;
    deliveryId?: string;
    payload: any;
    httpStatus: number;
    result: 'accepted' | 'skipped' | 'rejected' | 'error';
    code?: string;
    message?: string;
    payloadHash?: string;
    signatureVerified?: boolean;
    errorLayer?: WebhookErrorLayer;
    matchedRuleIds?: string[];
    matchedRobotIds?: string[];
    taskIds?: string[];
    taskGroupIds?: string[];
    replayOfEventId?: string;
    replayMode?: WebhookReplayMode;
    response?: any;
    debugTrace?: WebhookDebugTrace;
    dryRunResult?: WebhookDryRunResult;
  }
) => {
  try {
    await repoWebhookDeliveryService.createDelivery({
      repoId: input.repoId,
      provider: input.provider,
      eventName: input.eventName ?? null,
      mappedEventType: input.mappedEventType ?? null,
      deliveryId: input.deliveryId ?? null,
      result: input.result,
      httpStatus: input.httpStatus,
      code: input.code ?? null,
      message: input.message ?? null,
      payloadHash: input.payloadHash ?? null,
      signatureVerified: input.signatureVerified ?? null,
      errorLayer: input.errorLayer ?? null,
      matchedRuleIds: input.matchedRuleIds ?? [],
      matchedRobotIds: input.matchedRobotIds ?? [],
      taskIds: input.taskIds ?? [],
      taskGroupIds: input.taskGroupIds ?? [],
      replayOfEventId: input.replayOfEventId ?? null,
      replayMode: input.replayMode ?? null,
      payload: input.payload,
      response: input.response,
      debugTrace: input.debugTrace,
      dryRunResult: input.dryRunResult
    });
  } catch (err) {
    console.warn('[webhook] record delivery failed (ignored)', err);
  }
};

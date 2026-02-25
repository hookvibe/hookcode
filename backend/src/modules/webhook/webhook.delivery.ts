import type { RepoWebhookDeliveryService } from '../repositories/repo-webhook-delivery.service';
import type { RepoProvider } from '../../types/repository';

// Split webhook delivery recording into a dedicated module for reuse. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const recordWebhookDeliveryBestEffort = async (
  repoWebhookDeliveryService: RepoWebhookDeliveryService,
  input: {
    repoId: string;
    provider: RepoProvider;
    eventName?: string;
    deliveryId?: string;
    payload: any;
    httpStatus: number;
    result: 'accepted' | 'skipped' | 'rejected' | 'error';
    code?: string;
    message?: string;
    taskIds?: string[];
    response?: any;
  }
) => {
  try {
    await repoWebhookDeliveryService.createDelivery({
      repoId: input.repoId,
      provider: input.provider,
      eventName: input.eventName ?? null,
      deliveryId: input.deliveryId ?? null,
      result: input.result,
      httpStatus: input.httpStatus,
      code: input.code ?? null,
      message: input.message ?? null,
      taskIds: input.taskIds ?? [],
      payload: input.payload,
      response: input.response
    });
  } catch (err) {
    console.warn('[webhook] record delivery failed (ignored)', err);
  }
};

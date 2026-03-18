import { api, getCached, invalidateGetCache, invalidateTaskCaches } from './client';
import type { ListWebhookEventsParams, ReplayWebhookEventRequest, WebhookEventDetail, WebhookEventSummary } from './types';

const invalidateWebhookEventCaches = (eventId: string, repoId?: string) => {
  invalidateGetCache('/webhooks/events');
  invalidateGetCache(`/webhooks/events/${eventId}`);
  if (repoId) invalidateGetCache(`/repos/${repoId}/webhook-deliveries`);
  invalidateTaskCaches();
};

// Keep webhook replay/debug traffic in a focused API module so repo and admin screens share one contract. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const listWebhookEvents = async (
  params?: ListWebhookEventsParams
): Promise<{ events: WebhookEventSummary[]; nextCursor?: string }> =>
  getCached<{ events: WebhookEventSummary[]; nextCursor?: string }>('/webhooks/events', {
    params,
    cacheTtlMs: 5000
  });

export const fetchWebhookEvent = async (eventId: string): Promise<WebhookEventDetail> => {
  const data = await getCached<{ event: WebhookEventDetail }>(`/webhooks/events/${eventId}`, {
    cacheTtlMs: 30000
  });
  return data.event;
};

export const replayWebhookEvent = async (
  eventId: string,
  params?: ReplayWebhookEventRequest
): Promise<WebhookEventDetail> => {
  const { data } = await api.post<{ event: WebhookEventDetail }>(`/webhooks/events/${eventId}/replay`, params ?? {});
  invalidateWebhookEventCaches(eventId, data.event?.repoId);
  if (data.event?.id) invalidateGetCache(`/webhooks/events/${data.event.id}`);
  return data.event;
};

export const replayWebhookEventDryRun = async (
  eventId: string,
  params?: ReplayWebhookEventRequest
): Promise<WebhookEventDetail> => {
  const { data } = await api.post<{ event: WebhookEventDetail }>(`/webhooks/events/${eventId}/replay-dry-run`, params ?? {});
  invalidateWebhookEventCaches(eventId, data.event?.repoId);
  if (data.event?.id) invalidateGetCache(`/webhooks/events/${data.event.id}`);
  return data.event;
};

import { api, getCached, invalidateGetCache } from './client';
import type { ListNotificationsResponse, NotificationUnreadCountResponse, NotificationsReadAllResponse } from './types';

export interface FetchNotificationsParams {
  limit?: number;
  cursor?: string;
  unread?: boolean;
}

// Fetch notifications for the current user. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export const fetchNotifications = async (params?: FetchNotificationsParams): Promise<ListNotificationsResponse> => {
  return getCached<ListNotificationsResponse>('/notifications', { params, cacheTtlMs: 0 });
};

// Fetch unread notification count for badge display. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export const fetchNotificationsUnreadCount = async (): Promise<NotificationUnreadCountResponse> => {
  return getCached<NotificationUnreadCountResponse>('/notifications/unread-count', { cacheTtlMs: 0 });
};

// Mark all notifications as read for the current user. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export const markAllNotificationsRead = async (): Promise<NotificationsReadAllResponse> => {
  const res = await api.post<NotificationsReadAllResponse>('/notifications/read-all');
  invalidateGetCache('/notifications');
  return res.data;
};

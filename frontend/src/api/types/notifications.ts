// Define notification API types for the header panel and settings tab. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export type NotificationLevel = 'info' | 'warn' | 'error';
// Align notification types with the stop-only task lifecycle used by the backend. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
export type NotificationType = 'TASK_SUCCEEDED' | 'TASK_FAILED' | 'TASK_STOPPED' | 'TASK_DELETED';

export interface NotificationEntry {
  id: string;
  userId: string;
  type: NotificationType;
  level: NotificationLevel;
  message: string;
  code?: string;
  repoId?: string;
  taskId?: string;
  taskGroupId?: string;
  linkUrl?: string; // Keep the notification destination in the shared frontend contract for in-app hash and external navigation. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
  meta?: unknown;
  readAt?: string;
  createdAt: string;
}

export interface ListNotificationsResponse {
  notifications: NotificationEntry[];
  nextCursor?: string;
}

export interface NotificationUnreadCountResponse {
  count: number;
}

export interface NotificationsReadAllResponse {
  updated: number;
  readAt: string;
}

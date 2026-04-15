// Define notification API types for user alerts. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export type NotificationLevel = 'info' | 'warn' | 'error';
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
  linkUrl?: string; // Store the primary notification destination for in-app task pages or preserved external URLs. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
  meta?: unknown;
  readAt?: string;
  createdAt: string;
}

export interface ListNotificationsResponse {
  notifications: NotificationEntry[];
  nextCursor?: string;
}

export interface UnreadCountResponse {
  count: number;
}

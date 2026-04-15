const normalizeAbsoluteNotificationUrl = (value: string | undefined): string | undefined => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
};

const encodeHashSegment = (value: string | undefined): string | undefined => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return undefined;
  return encodeURIComponent(trimmed);
};

export interface NotificationLinkTarget {
  taskId?: string;
  externalUrl?: string;
}

// Prefer in-app task detail hashes, then preserve absolute external URLs for notifications without an internal page. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
export const buildNotificationLinkUrl = (target: NotificationLinkTarget): string | undefined => {
  const taskId = encodeHashSegment(target.taskId);
  if (taskId) return `#/tasks/${taskId}`;
  return normalizeAbsoluteNotificationUrl(target.externalUrl);
};

import { isInAppHash } from '../navHistory';

export const normalizeNotificationLinkUrl = (value: string | undefined): string | undefined => {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
};

// Accept only hash-router links or absolute http(s) URLs so notification navigation stays predictable. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
export const isExternalNotificationLinkUrl = (value: string | undefined): boolean => {
  const normalized = normalizeNotificationLinkUrl(value);
  if (!normalized || isInAppHash(normalized)) return false;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

// Reuse the shared hash-router guard so notification links only render when the target is a supported route or external URL. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
export const isSupportedNotificationLinkUrl = (value: string | undefined): boolean => {
  const normalized = normalizeNotificationLinkUrl(value);
  if (!normalized) return false;
  return isInAppHash(normalized) || isExternalNotificationLinkUrl(normalized);
};

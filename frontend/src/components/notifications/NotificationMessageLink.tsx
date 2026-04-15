import type { FC, MouseEvent } from 'react';
import { Typography } from 'antd';
import type { NotificationEntry } from '../../api';
import { isExternalNotificationLinkUrl, isSupportedNotificationLinkUrl, normalizeNotificationLinkUrl } from '../../utils/notificationLinks';

export interface NotificationMessageLinkProps {
  notification: Pick<NotificationEntry, 'message' | 'linkUrl'>;
  className?: string;
  onNavigate?: () => void;
}

// Render notification messages as links only when the destination is a supported in-app hash or absolute external URL. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
export const NotificationMessageLink: FC<NotificationMessageLinkProps> = ({ notification, className, onNavigate }) => {
  const linkUrl = normalizeNotificationLinkUrl(notification.linkUrl);
  if (!isSupportedNotificationLinkUrl(linkUrl)) return <span className={className}>{notification.message}</span>;

  const external = isExternalNotificationLinkUrl(linkUrl);
  const externalLinkProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {}; // Keep external notification navigation on the original absolute URL without changing internal hash-link behavior. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!linkUrl) return;
    if (!external) {
      event.preventDefault();
      if (typeof window !== 'undefined') window.location.hash = linkUrl;
    }
    onNavigate?.();
  };

  return (
    <Typography.Link
      className={className}
      href={linkUrl}
      onClick={handleClick}
      {...externalLinkProps}
    >
      {notification.message}
    </Typography.Link>
  );
};

import { FC, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Popover, Space, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { fetchNotifications, fetchNotificationsUnreadCount, markAllNotificationsRead } from '../../api';
import type { NotificationEntry } from '../../api';
import { createAuthedEventSource } from '../../utils/sse';
import { buildSettingsHash } from '../../router';
import { useT } from '../../i18n';

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatLevelLabel = (level: NotificationEntry['level']): string => {
  if (level === 'error') return 'Error';
  if (level === 'warn') return 'Warn';
  return 'Info';
};

// Header notifications popover with unread badge and quick actions. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export const NotificationsPopover: FC = () => {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Track in-flight mark-all-read requests to avoid duplicate updates. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  const [markingRead, setMarkingRead] = useState(false);

  const listEmpty = notifications.length === 0;

  const loadUnreadCount = async () => {
    try {
      const res = await fetchNotificationsUnreadCount();
      setUnreadCount(res.count ?? 0);
    } catch {
      // Ignore badge failures silently to avoid blocking UI. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetchNotifications({ limit: 5 });
      setNotifications(res.notifications || []);
    } catch {
      // Ignore list failures (panel still renders). docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async (options?: { close?: boolean }) => {
    // Apply read-all updates (and optional close) for popover actions. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    if (markingRead) return;
    const hasUnread = unreadCount > 0 || notifications.some((item) => !item.readAt);
    if (!hasUnread) {
      if (options?.close) setOpen(false);
      return;
    }
    setMarkingRead(true);
    try {
      const res = await markAllNotificationsRead();
      const readAt = res.readAt || new Date().toISOString();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt })));
      if (options?.close) setOpen(false);
    } catch {
      // Ignore failures; user can retry. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
    } finally {
      setMarkingRead(false);
    }
  };

  const viewAll = () => {
    window.location.hash = buildSettingsHash('notifications');
    setOpen(false);
  };

  const content = useMemo(() => {
    return (
      <div className="hc-notifications-popover">
        <div className="hc-notifications-popover__header">
          <Typography.Text strong>{t('panel.notifications.title')}</Typography.Text>
          <Space size={8}>
            <Button size="small" type="text" onClick={() => void markAllRead({ close: true })} disabled={unreadCount === 0}>
              {t('panel.notifications.readAll')}
            </Button>
            <Button size="small" type="link" onClick={viewAll}>
              {t('panel.notifications.viewAll')}
            </Button>
          </Space>
        </div>
        <div className="hc-notifications-popover__body">
          {loading ? (
            <div className="hc-notifications-popover__loading">{t('common.loading')}</div>
          ) : listEmpty ? (
            <div className="hc-notifications-popover__empty">{t('panel.notifications.empty')}</div>
          ) : (
            <div className="hc-notifications-popover__list">
              {notifications.map((item) => (
                <div key={item.id} className={`hc-notifications-popover__item ${item.readAt ? 'is-read' : 'is-unread'}`}>
                  <div className="hc-notifications-popover__item-meta">
                    <span className={`hc-notifications-popover__level hc-notifications-popover__level--${item.level}`}>{formatLevelLabel(item.level)}</span>
                    <span className="hc-notifications-popover__time">{formatTimestamp(item.createdAt)}</span>
                  </div>
                  <div className="hc-notifications-popover__message">{item.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }, [listEmpty, loading, notifications, t, unreadCount]);

  useEffect(() => {
    void loadUnreadCount();
  }, []);

  useEffect(() => {
    const source = createAuthedEventSource('/events/stream', { topics: 'notifications' });
    const handleNotification = (event: MessageEvent) => {
      try {
        const entry = JSON.parse(event.data) as NotificationEntry;
        setUnreadCount((prev) => prev + 1);
        setNotifications((prev) => [entry, ...prev].slice(0, 5));
      } catch {
        // Ignore malformed events. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      }
    };
    const handleReadAll = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { readAt?: string };
        const readAt = payload.readAt || new Date().toISOString();
        setUnreadCount(0);
        setNotifications((prev) => prev.map((item) => ({ ...item, readAt })));
      } catch {
        // Ignore malformed events. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      }
    };
    source.addEventListener('notification', handleNotification);
    source.addEventListener('notifications.read_all', handleReadAll);
    return () => {
      source.removeEventListener('notification', handleNotification);
      source.removeEventListener('notifications.read_all', handleReadAll);
      source.close();
    };
  }, []);

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      destroyOnHidden // Keep notification popover teardown aligned with the current Ant Design API. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          void loadNotifications();
          // Treat opening the popover as "read" when unread notifications exist. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
          void markAllRead();
        }
      }}
      placement="bottomRight"
      overlayClassName="hc-notifications-popover__overlay"
    >
      <button type="button" className="hc-notifications-trigger" aria-label={t('panel.notifications.title')}>
        <Badge count={unreadCount} size="small" overflowCount={99}>
          <BellOutlined />
        </Badge>
      </button>
    </Popover>
  );
};

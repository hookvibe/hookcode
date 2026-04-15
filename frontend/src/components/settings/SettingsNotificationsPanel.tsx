import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchNotifications, markAllNotificationsRead } from '../../api';
import type { NotificationEntry, NotificationLevel } from '../../api';
import { createAuthedEventSource } from '../../utils/sse';
import { useT } from '../../i18n';
import { SETTINGS_DATA_TABLE_CLASS_NAME, SETTINGS_DATA_TABLE_SCROLL_X } from './layout';
import { NotificationMessageLink } from '../notifications/NotificationMessageLink';

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const levelColor = (level: NotificationLevel): string => {
  if (level === 'error') return 'red';
  if (level === 'warn') return 'gold';
  return 'blue';
};

const PAGE_SIZE = 20; // Keep notifications table pagination compact for settings. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
const PAGE_FETCH_LIMIT = 50; // Align fetch size with existing API defaults. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303

// Settings notifications panel with pagination and read-all. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
export const SettingsNotificationsPanel: FC = () => {
  const t = useT();
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [live, setLive] = useState(true);
  // Track the current pagination page for the notifications table. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  const [page, setPage] = useState(1);
  const sourceRef = useRef<EventSource | null>(null);

  const columns = useMemo<ColumnsType<NotificationEntry>>(
    () => [
      {
        title: 'Time',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 180,
        render: (value) => <span>{formatTimestamp(value)}</span>
      },
      {
        title: 'Level',
        dataIndex: 'level',
        key: 'level',
        width: 90,
        render: (value: NotificationLevel) => <Tag color={levelColor(value)}>{value.toUpperCase()}</Tag>
      },
      {
        title: 'Status',
        key: 'status',
        width: 90,
        render: (_, record) => (
          <Tag color={record.readAt ? 'default' : 'green'}>{record.readAt ? 'Read' : 'Unread'}</Tag>
        )
      },
      {
        title: 'Message',
        dataIndex: 'message',
        key: 'message',
        width: 360,
        render: (_value: string, record) => (
          <NotificationMessageLink notification={record} /> // Reuse the shared notification link renderer so settings-table navigation matches the header popover. docs/en/developer/plans/cv3zazhx2a716nfc0wn9/task_plan.md cv3zazhx2a716nfc0wn9
        )
      },
      {
        title: 'Context',
        key: 'context',
        width: 240,
        render: (_, record) => (
          <Space direction="vertical" size={2}>
            {record.repoId ? <Typography.Text type="secondary">Repo: {record.repoId}</Typography.Text> : null}
            {record.taskId ? <Typography.Text type="secondary">Task: {record.taskId}</Typography.Text> : null}
            {record.taskGroupId ? <Typography.Text type="secondary">Group: {record.taskGroupId}</Typography.Text> : null}
          </Space>
        )
      }
    ],
    []
  );

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Reset pagination to the first page when reloading notifications. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    setPage(1);
    try {
      const res = await fetchNotifications({
        limit: PAGE_FETCH_LIMIT,
        unread: unreadOnly ? true : undefined
      });
      setNotifications(res.notifications || []);
      setNextCursor(res.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  const ensurePageData = useCallback(
    async (targetPage: number) => {
      // Drive cursor fetches to satisfy table pagination requests. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
      const safePage = Math.max(targetPage, 1);
      setPage(safePage);
      if (notifications.length >= safePage * PAGE_SIZE || !nextCursor) return;
      setLoadingMore(true);
      setError(null);
      try {
        let cursor: string | undefined = nextCursor;
        let next = notifications;
        const targetCount = safePage * PAGE_SIZE;
        while (cursor && next.length < targetCount) {
          const res = await fetchNotifications({
            limit: PAGE_FETCH_LIMIT,
            cursor,
            unread: unreadOnly ? true : undefined
          });
          const batch = res.notifications || [];
          const existing = new Set(next.map((item) => item.id));
          next = [...next, ...batch.filter((item) => !existing.has(item.id))];
          cursor = res.nextCursor;
          if (!batch.length) break;
        }
        setNotifications(next);
        setNextCursor(cursor);
      } catch (err: any) {
        setError(err?.message || 'Failed to load more notifications');
      } finally {
        setLoadingMore(false);
      }
    },
    [nextCursor, notifications, unreadOnly]
  );

  const markAllRead = async () => {
    try {
      const res = await markAllNotificationsRead();
      // Keep pagination state aligned after marking all notifications read. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
      setNotifications((prev) => {
        const updated = prev.map((item) => ({ ...item, readAt: res.readAt }));
        return unreadOnly ? updated.filter((item) => !item.readAt) : updated;
      });
      setPage(1);
    } catch (err: any) {
      setError(err?.message || 'Failed to mark notifications read');
    }
  };

  const pagedNotifications = useMemo(() => {
    // Slice the loaded notifications to the active table page. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    const start = (page - 1) * PAGE_SIZE;
    return notifications.slice(start, start + PAGE_SIZE);
  }, [notifications, page]);

  const paginationTotal = useMemo(() => {
    // Expose a virtual next page when cursor pagination indicates more data. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    if (nextCursor) return Math.max(notifications.length + PAGE_SIZE, page * PAGE_SIZE);
    return notifications.length;
  }, [nextCursor, notifications.length, page]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (!live) return;
    const source = createAuthedEventSource('/events/stream', { topics: 'notifications' });
    sourceRef.current = source;

    const handleNotification = (event: MessageEvent) => {
      try {
        const entry = JSON.parse(event.data) as NotificationEntry;
        if (unreadOnly && entry.readAt) return;
        setNotifications((prev) => [entry, ...prev].slice(0, 200));
      } catch {
        // Ignore malformed entries. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      }
    };

    const handleReadAll = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data) as { readAt?: string };
        const readAt = payload.readAt || new Date().toISOString();
        // Sync read-all events with pagination filters. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
        setNotifications((prev) => {
          const updated = prev.map((item) => ({ ...item, readAt }));
          return unreadOnly ? updated.filter((item) => !item.readAt) : updated;
        });
        setPage(1);
      } catch {
        // Ignore malformed entries. docs/en/developer/plans/notify-panel-20260302/task_plan.md notify-panel-20260302
      }
    };

    source.addEventListener('notification', handleNotification);
    source.addEventListener('notifications.read_all', handleReadAll);

    return () => {
      source.removeEventListener('notification', handleNotification);
      source.removeEventListener('notifications.read_all', handleReadAll);
      source.close();
      sourceRef.current = null;
    };
  }, [live, unreadOnly]);

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Button onClick={() => void loadNotifications()} disabled={loading}>
            {t('common.refresh')}
          </Button>
          <Button onClick={markAllRead} disabled={notifications.length === 0}>
            {t('panel.notifications.readAll')}
          </Button>
          <Space size="small">
            <Switch checked={unreadOnly} onChange={setUnreadOnly} />
            <Typography.Text type="secondary">{t('panel.notifications.unreadOnly')}</Typography.Text>
          </Space>
          <Space size="small">
            <Switch checked={live} onChange={setLive} />
            <Typography.Text type="secondary">{t('panel.notifications.live')}</Typography.Text>
          </Space>
        </Space>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        <Table
          // Keep notification columns horizontally scrollable when the shared settings shell is too narrow. docs/en/developer/plans/settings-table-layout-20260312/task_plan.md settings-table-layout-20260312
          className={SETTINGS_DATA_TABLE_CLASS_NAME}
          rowKey={(record) => record.id}
          columns={columns}
          dataSource={pagedNotifications}
          scroll={{ x: SETTINGS_DATA_TABLE_SCROLL_X }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total: paginationTotal,
            showSizeChanger: false,
            onChange: (nextPage) => void ensurePageData(nextPage)
          }}
          loading={loading || loadingMore}
          size="small"
        />
      </Space>
    </div>
  );
};

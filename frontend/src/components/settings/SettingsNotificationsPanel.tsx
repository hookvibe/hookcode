import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchNotifications, markAllNotificationsRead } from '../../api';
import type { NotificationEntry, NotificationLevel } from '../../api';
import { createAuthedEventSource } from '../../utils/sse';
import { useT } from '../../i18n';

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
        render: (value: string) => <span>{value}</span>
      },
      {
        title: 'Context',
        key: 'context',
        width: 200,
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
    try {
      const res = await fetchNotifications({
        limit: 50,
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

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetchNotifications({
        limit: 50,
        cursor: nextCursor,
        unread: unreadOnly ? true : undefined
      });
      setNotifications((prev) => [...prev, ...(res.notifications || [])]);
      setNextCursor(res.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Failed to load more notifications');
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, unreadOnly]);

  const markAllRead = async () => {
    try {
      const res = await markAllNotificationsRead();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: res.readAt })));
    } catch (err: any) {
      setError(err?.message || 'Failed to mark notifications read');
    }
  };

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
        setNotifications((prev) => prev.map((item) => ({ ...item, readAt })));
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
          rowKey={(record) => record.id}
          columns={columns}
          dataSource={notifications}
          pagination={false}
          loading={loading}
          size="small"
        />

        {nextCursor ? (
          <Button onClick={() => void loadMore()} loading={loadingMore}>
            Load more
          </Button>
        ) : null}
      </Space>
    </div>
  );
};

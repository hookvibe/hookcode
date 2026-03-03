import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Input, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { fetchSystemLogs } from '../../api';
import type { SystemLogCategory, SystemLogEntry, SystemLogLevel } from '../../api';
import { createAuthedEventSource } from '../../utils/sse';

const CATEGORY_OPTIONS: Array<{ value: SystemLogCategory; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'operation', label: 'Operation' },
  { value: 'execution', label: 'Execution' }
];

const LEVEL_OPTIONS: Array<{ value: SystemLogLevel; label: string }> = [
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' }
];

const formatTimestamp = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const levelColor = (level: SystemLogLevel): string => {
  if (level === 'error') return 'red';
  if (level === 'warn') return 'gold';
  return 'blue';
};

const LOG_PAGE_SIZE = 20; // Keep system log pagination manageable in settings. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
const LOG_FETCH_LIMIT = 50; // Align log fetch size with existing API usage. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303

// Settings log panel with filtering + live SSE updates. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
export const SettingsLogsPanel: FC = () => {
  const [logs, setLogs] = useState<SystemLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<SystemLogCategory | 'all'>('all');
  const [level, setLevel] = useState<SystemLogLevel | 'all'>('all');
  const [queryInput, setQueryInput] = useState('');
  const [query, setQuery] = useState('');
  const [live, setLive] = useState(true);
  // Track the current pagination page for the logs table. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
  const [page, setPage] = useState(1);
  const sourceRef = useRef<EventSource | null>(null);

  const columns = useMemo<ColumnsType<SystemLogEntry>>(
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
        render: (value: SystemLogLevel) => <Tag color={levelColor(value)}>{value.toUpperCase()}</Tag>
      },
      {
        title: 'Category',
        dataIndex: 'category',
        key: 'category',
        width: 120,
        render: (value: SystemLogCategory) => <Tag>{value}</Tag>
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

  const matchesFilters = useCallback(
    (entry: SystemLogEntry): boolean => {
      if (category !== 'all' && entry.category !== category) return false;
      if (level !== 'all' && entry.level !== level) return false;
      if (query) {
        const q = query.toLowerCase();
        const msg = entry.message.toLowerCase();
        const code = (entry.code ?? '').toLowerCase();
        if (!msg.includes(q) && !code.includes(q)) return false;
      }
      return true;
    },
    [category, level, query]
  );

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Reset pagination to the first page when filters or query change. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    setPage(1);
    try {
      const res = await fetchSystemLogs({
        limit: LOG_FETCH_LIMIT,
        category: category === 'all' ? undefined : category,
        level: level === 'all' ? undefined : level,
        q: query || undefined
      });
      setLogs(res.logs || []);
      setNextCursor(res.nextCursor);
    } catch (err: any) {
      setError(err?.message || 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [category, level, query]);

  const ensurePageData = useCallback(
    async (targetPage: number) => {
      // Fetch additional log pages to satisfy table pagination. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
      const safePage = Math.max(targetPage, 1);
      setPage(safePage);
      if (logs.length >= safePage * LOG_PAGE_SIZE || !nextCursor) return;
      setLoadingMore(true);
      setError(null);
      try {
        let cursor: string | undefined = nextCursor;
        let next = logs;
        const targetCount = safePage * LOG_PAGE_SIZE;
        while (cursor && next.length < targetCount) {
          const res = await fetchSystemLogs({
            limit: LOG_FETCH_LIMIT,
            cursor,
            category: category === 'all' ? undefined : category,
            level: level === 'all' ? undefined : level,
            q: query || undefined
          });
          const batch = res.logs || [];
          const existing = new Set(next.map((item) => item.id));
          next = [...next, ...batch.filter((item) => !existing.has(item.id))];
          cursor = res.nextCursor;
          if (!batch.length) break;
        }
        setLogs(next);
        setNextCursor(cursor);
      } catch (err: any) {
        setError(err?.message || 'Failed to load more logs');
      } finally {
        setLoadingMore(false);
      }
    },
    [category, level, logs, nextCursor, query]
  );

  const pagedLogs = useMemo(() => {
    // Slice loaded logs for the active pagination page. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    const start = (page - 1) * LOG_PAGE_SIZE;
    return logs.slice(start, start + LOG_PAGE_SIZE);
  }, [logs, page]);

  const paginationTotal = useMemo(() => {
    // Expose an extra page when cursor pagination indicates more data. docs/en/developer/plans/notifications-ui-20260303/task_plan.md notifications-ui-20260303
    if (nextCursor) return Math.max(logs.length + LOG_PAGE_SIZE, page * LOG_PAGE_SIZE);
    return logs.length;
  }, [nextCursor, logs.length, page]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!live) return;
    const source = createAuthedEventSource('/logs/stream');
    sourceRef.current = source;
    const handleLog = (event: MessageEvent) => {
      try {
        const entry = JSON.parse(event.data) as SystemLogEntry;
        if (!matchesFilters(entry)) return;
        setLogs((prev) => [entry, ...prev].slice(0, 200));
      } catch {
        // ignore malformed entries
      }
    };
    source.addEventListener('log', handleLog);
    return () => {
      source.removeEventListener('log', handleLog);
      source.close();
      sourceRef.current = null;
    };
  }, [live, matchesFilters]);

  return (
    <div>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space wrap>
          <Select
            style={{ minWidth: 140 }}
            value={category}
            onChange={(value) => setCategory(value)}
            options={[{ value: 'all', label: 'All categories' }, ...CATEGORY_OPTIONS]}
          />
          <Select
            style={{ minWidth: 120 }}
            value={level}
            onChange={(value) => setLevel(value)}
            options={[{ value: 'all', label: 'All levels' }, ...LEVEL_OPTIONS]}
          />
          <Input.Search
            placeholder="Search message or code"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onSearch={(value) => setQuery(value.trim())}
            allowClear
            style={{ minWidth: 240 }}
          />
          <Button onClick={() => void loadLogs()} disabled={loading}>
            Refresh
          </Button>
          <Space size="small">
            <Switch checked={live} onChange={setLive} />
            <Typography.Text type="secondary">Live</Typography.Text>
          </Space>
          {/* Explain the live stream retention cap. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 */}
          <Typography.Text type="secondary">Live mode keeps the newest 200 entries.</Typography.Text>
        </Space>

        {error ? <Alert type="error" showIcon message={error} /> : null}

        <Table
          rowKey={(record) => record.id}
          columns={columns}
          dataSource={pagedLogs}
          pagination={{
            current: page,
            pageSize: LOG_PAGE_SIZE,
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

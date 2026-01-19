import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Progress, Skeleton, Space, Typography } from 'antd';
import type { Task, TaskStatusStats } from '../../api';
import { fetchTaskStats, fetchTasks } from '../../api';
import { useT } from '../../i18n';
import { buildTaskHash, buildTasksHash } from '../../router';
import { clampText, getTaskEventText } from '../../utils/task';
import { RepoTaskVolumeTrend } from './RepoTaskVolumeTrend';

type TaskStatKey = 'queued' | 'processing' | 'success' | 'failed';

const TASK_STAT_KEYS: TaskStatKey[] = ['queued', 'processing', 'success', 'failed'];

const statColor = (key: TaskStatKey): string => {
  if (key === 'success') return '#22c55e';
  if (key === 'failed') return '#ef4444';
  if (key === 'processing') return '#3b82f6';
  return '#94a3b8';
};

export interface RepoTaskActivityCardProps {
  repoId: string;
}

export const RepoTaskActivityCard: FC<RepoTaskActivityCardProps> = ({ repoId }) => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [stats, setStats] = useState<TaskStatusStats | null>(null);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [volumeRefreshSeq, setVolumeRefreshSeq] = useState(0);

  const refresh = useCallback(async () => {
    setVolumeRefreshSeq((seq) => seq + 1);
    setLoading(true);
    setLoadFailed(false);
    try {
      const [nextStats, nextTasks] = await Promise.all([
        fetchTaskStats({ repoId }),
        // Fetch a bounded recent window to compute "last task" without loading the full task history. dashtrendline20260119m9v2
        fetchTasks({ repoId, limit: 200 })
      ]);
      setStats(nextStats);
      setRecentTasks(Array.isArray(nextTasks) ? nextTasks : []);
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
      setStats(null);
      setRecentTasks([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const derived = useMemo(() => {
    const s: TaskStatusStats = stats ?? { total: 0, queued: 0, processing: 0, success: 0, failed: 0 };
    const total = s.total ?? 0;
    const successRate = total ? (s.success ?? 0) / total : 0;
    const successPercent = Math.round(successRate * 100);

    const sorted = Array.isArray(recentTasks)
      ? [...recentTasks].sort((a, b) => String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')))
      : [];
    const latestTotal = sorted.slice(0, 3);
    const latestProcessing = sorted.filter((task) => task.status === 'processing').slice(0, 3);
    const latestFailed = sorted.filter((task) => task.status === 'failed').slice(0, 3);
    const latestSuccess = sorted.filter((task) => task.status === 'succeeded' || task.status === 'commented').slice(0, 3);

    const distTotal = (s.queued ?? 0) + (s.processing ?? 0) + (s.success ?? 0) + (s.failed ?? 0);
    const distribution = TASK_STAT_KEYS.map((k) => ({
      key: k,
      count: (s as any)?.[k] ?? 0,
      pct: distTotal ? Math.round((((s as any)?.[k] ?? 0) / distTotal) * 100) : 0
    }));

    return {
      total,
      processing: s.processing ?? 0,
      failed: s.failed ?? 0,
      success: s.success ?? 0,
      successPercent,
      latestTotal,
      latestProcessing,
      latestFailed,
      latestSuccess,
      distribution
    };
  }, [recentTasks, stats]);

  const hasAnyTasks = Boolean(
    stats && ((stats.total ?? 0) > 0 || (stats.queued ?? 0) > 0 || (stats.processing ?? 0) > 0 || (stats.success ?? 0) > 0 || (stats.failed ?? 0) > 0)
  );

  const openTask = useCallback((taskId: string) => {
    window.location.hash = buildTaskHash(taskId);
  }, []);

  const openAll = useCallback(
    (status?: string) => {
      // Use repo-scoped Tasks page query so "View all" stays within the current repository. aw85xyfsp5zfg6ihq3jr
      window.location.hash = buildTasksHash({ status, repoId });
    },
    [repoId]
  );

  const taskButtonLabel = useCallback(
    (task: Task): string => {
      const eventText = getTaskEventText(t, task.eventType);
      const shortId = clampText(String(task.id ?? ''), 10);
      return `${eventText} · ${shortId}`;
    },
    [t]
  );

  const renderMetric = (options: {
    label: string;
    count: number;
    status?: string;
    tasks: Task[];
    testId: string;
  }) => (
    <div className="hc-repo-activity__metric" data-testid={options.testId}>
      {/* Render recent task shortcuts + "View all" per status to speed up repo triage. aw85xyfsp5zfg6ihq3jr */}
      <div className="hc-repo-activity__metric-head">
        <Typography.Text type="secondary" className="hc-repo-activity__metric-label">
          {options.label}
        </Typography.Text>
        <Button
          type="link"
          size="small"
          style={{ padding: 0 }}
          aria-label={`${t('sidebar.tasks.viewAll')} ${options.label}`}
          onClick={() => openAll(options.status)}
        >
          {t('sidebar.tasks.viewAll')}
        </Button>
      </div>

      <Typography.Text className="hc-repo-activity__metric-value">{options.count}</Typography.Text>

      <div className="hc-repo-activity__metric-tasks">
        {options.tasks.length ? (
          options.tasks.map((task) => (
            <Button
              key={task.id}
              type="link"
              size="small"
              className="hc-repo-activity__metric-taskBtn"
              style={{ padding: 0 }}
              onClick={() => openTask(task.id)}
              aria-label={`${t('common.view')} ${task.id}`}
              title={task.id}
            >
              {taskButtonLabel(task)}
            </Button>
          ))
        ) : (
          <Typography.Text type="secondary">-</Typography.Text>
        )}
      </div>
    </div>
  );

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <BarChartOutlined />
          <span>{t('repos.dashboard.activity.tasks.title')}</span>
        </Space>
      }
      className="hc-card"
      extra={
        <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
          {t('common.refresh')}
        </Button>
      }
    >
      {loading && !stats ? (
        <>
          {/* Reserve space with skeletons to avoid dashboard content jumping while task stats load. ro3ln7zex8d0wyynfj0m */}
          <Skeleton active title={false} paragraph={{ rows: 6, width: ['92%', '88%', '96%', '86%', '90%', '60%'] }} />
        </>
      ) : stats && hasAnyTasks ? (
        <div className="hc-repo-activity">
          <div className="hc-repo-activity__top">
            <div className="hc-repo-activity__gauge">
              <Progress
                type="circle"
                size={70}
                percent={derived.successPercent}
                status={derived.successPercent >= 80 ? 'success' : derived.successPercent >= 50 ? 'normal' : 'exception'}
                format={(p) => `${p ?? 0}%`}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('repos.dashboard.activity.tasks.successRate')}
              </Typography.Text>
            </div>

            <div className="hc-repo-activity__metrics">
              {renderMetric({
                label: t('repos.dashboard.activity.tasks.total'),
                count: derived.total,
                tasks: derived.latestTotal,
                testId: 'hc-repo-activity-total'
              })}
              {renderMetric({
                label: t('repos.dashboard.activity.tasks.status.processing'),
                count: derived.processing,
                status: 'processing',
                tasks: derived.latestProcessing,
                testId: 'hc-repo-activity-processing'
              })}
              {renderMetric({
                label: t('repos.dashboard.activity.tasks.status.failed'),
                count: derived.failed,
                status: 'failed',
                tasks: derived.latestFailed,
                testId: 'hc-repo-activity-failed'
              })}
              {renderMetric({
                label: t('repos.dashboard.activity.tasks.status.success'),
                count: derived.success,
                status: 'success',
                tasks: derived.latestSuccess,
                testId: 'hc-repo-activity-success'
              })}
            </div>
          </div>

          <div className="hc-repo-activity__block">
            <Typography.Text type="secondary" className="hc-repo-activity__block-title">
              {t('repos.dashboard.activity.tasks.distribution')}
            </Typography.Text>
            <div className="hc-repo-activity__dist-bar" role="img" aria-label={t('repos.dashboard.activity.tasks.distribution')}>
              {derived.distribution.map((seg) => (
                <div
                  key={seg.key}
                  className="hc-repo-activity__dist-seg"
                  style={{
                    width: `${seg.pct}%`,
                    background: statColor(seg.key as TaskStatKey)
                  }}
                />
              ))}
            </div>
            <div className="hc-repo-activity__legend">
              {derived.distribution.map((seg) => (
                <div key={seg.key} className="hc-repo-activity__legend-item">
                  <span className="hc-repo-activity__legend-dot" style={{ background: statColor(seg.key as TaskStatKey) }} aria-hidden />
                  <Typography.Text>
                    {t(`repos.dashboard.activity.tasks.status.${seg.key}` as any)}{' '}
                    <Typography.Text type="secondary">
                      {seg.count} ({seg.pct}%)
                    </Typography.Text>
                  </Typography.Text>
                </div>
              ))}
            </div>
          </div>

          <div className="hc-repo-activity__block">
            <Typography.Text type="secondary" className="hc-repo-activity__block-title">
              {t('repos.dashboard.activity.tasks.volume')}
            </Typography.Text>
            <RepoTaskVolumeTrend repoId={repoId} refreshSeq={volumeRefreshSeq} />
          </div>
        </div>
      ) : (
        <div className="hc-empty">
          {loadFailed ? <Typography.Text type="danger">{t('repos.dashboard.activity.tasks.loadFailed')}</Typography.Text> : null}
          <Empty description={t('repos.dashboard.activity.tasks.empty')} />
        </div>
      )}
    </Card>
  );
};

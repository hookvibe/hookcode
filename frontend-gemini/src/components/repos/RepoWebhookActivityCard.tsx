import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { ReloadOutlined } from '@/ui/icons';
import { Button, Card, Empty, Progress, Skeleton, Typography } from '@/ui';
import type { RepoWebhookDeliveryResult, RepoWebhookDeliverySummary } from '../../api';
import { listRepoWebhookDeliveries } from '../../api';
import { useLocale, useT } from '../../i18n';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

type ResultKey = RepoWebhookDeliveryResult;

const RESULT_KEYS: ResultKey[] = ['accepted', 'skipped', 'rejected', 'error'];

const resultColor = (key: ResultKey): string => {
  if (key === 'accepted') return '#22c55e';
  if (key === 'skipped') return '#94a3b8';
  if (key === 'rejected') return '#f97316';
  return '#ef4444';
};

const dayKeyUtc = (iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
  } catch {
    return '';
  }
};

const addDaysUtc = (day: string, delta: number): string => {
  try {
    const d = new Date(`${day}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  } catch {
    return day;
  }
};

const formatDayLabel = (locale: string, day: string): string => {
  try {
    const d = new Date(`${day}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return day;
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(d);
  } catch {
    return day;
  }
};

const formatDateTime = (locale: string, iso: string): string => {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
  } catch {
    return iso;
  }
};

export interface RepoWebhookActivityCardProps {
  repoId: string;
}

export const RepoWebhookActivityCard: FC<RepoWebhookActivityCardProps> = ({ repoId }) => {
  const t = useT();
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [deliveries, setDeliveries] = useState<RepoWebhookDeliverySummary[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const data = await listRepoWebhookDeliveries(repoId, { limit: 50 });
      setDeliveries(Array.isArray(data?.deliveries) ? data.deliveries : []);
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    const counts: Record<ResultKey, number> = { accepted: 0, skipped: 0, rejected: 0, error: 0 };
    let lastAt = '';
    const perDay = new Map<string, number>();

    for (const d of deliveries) {
      const k = (d?.result as ResultKey) || 'error';
      if (counts[k] !== undefined) counts[k] += 1;
      const createdAt = String(d?.createdAt ?? '').trim();
      if (createdAt && (!lastAt || createdAt > lastAt)) lastAt = createdAt;
      const day = dayKeyUtc(createdAt);
      if (day) perDay.set(day, (perDay.get(day) ?? 0) + 1);
    }

    const total = deliveries.length;
    const acceptedRate = total ? counts.accepted / total : 0;
    const acceptedPercent = Math.round(acceptedRate * 100);

    const anchorDay = dayKeyUtc(lastAt) || dayKeyUtc(new Date().toISOString());
    const days = anchorDay ? Array.from({ length: 7 }, (_, idx) => addDaysUtc(anchorDay, idx - 6)) : [];
    const maxDayCount = days.reduce((m, d) => Math.max(m, perDay.get(d) ?? 0), 0);

    return {
      counts,
      total,
      lastAt,
      acceptedPercent,
      days: days.map((d) => ({ day: d, count: perDay.get(d) ?? 0 })),
      maxDayCount
    };
  }, [deliveries]);

  const distribution = useMemo(() => {
    if (!stats.total) return [];
    return RESULT_KEYS.map((k) => ({
      key: k,
      count: stats.counts[k] ?? 0,
      pct: stats.total ? Math.round((stats.counts[k] / stats.total) * 100) : 0
    }));
  }, [stats.counts, stats.total]);

  return (
    <Card
      size="small"
      title={t('repos.dashboard.activity.webhook.title')}
      className="hc-card"
      extra={
        <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
          {t('common.refresh')}
        </Button>
      }
    >
      {/* Add lightweight webhook delivery stats + charts to enrich the repo details dashboard. u55e45ffi8jng44erdzp */}
      {loadFailed ? <Typography.Text type="danger">{t('repos.webhookDeliveries.loadFailed')}</Typography.Text> : null}

      {loading ? (
        <Skeleton active title={false} paragraph={{ rows: 7, width: ['76%', '92%', '88%', '70%', '96%', '82%', '62%'] }} />
      ) : stats.total ? (
        <div className="hc-repo-activity">
          <div className="hc-repo-activity__top">
            <div className="hc-repo-activity__gauge">
              <Progress
                type="dashboard"
                size={84}
                percent={stats.acceptedPercent}
                strokeColor={resultColor('accepted')}
                trailColor="rgba(148, 163, 184, 0.25)"
                format={(p) => `${p ?? 0}%`}
              />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('repos.dashboard.activity.webhook.acceptedRate')}
              </Typography.Text>
            </div>

            <div className="hc-repo-activity__metrics">
              <div className="hc-repo-activity__metric">
                <Typography.Text type="secondary" className="hc-repo-activity__metric-label">
                  {t('repos.dashboard.activity.webhook.total')}
                </Typography.Text>
                <Typography.Text className="hc-repo-activity__metric-value">{stats.total}</Typography.Text>
              </div>
              <div className="hc-repo-activity__metric">
                <Typography.Text type="secondary" className="hc-repo-activity__metric-label">
                  {t('repos.webhookDeliveries.result.error')}
                </Typography.Text>
                <Typography.Text className="hc-repo-activity__metric-value">{stats.counts.error}</Typography.Text>
              </div>
              <div className="hc-repo-activity__metric">
                <Typography.Text type="secondary" className="hc-repo-activity__metric-label">
                  {t('repos.dashboard.activity.webhook.lastDelivery')}
                </Typography.Text>
                <Typography.Text className="hc-repo-activity__metric-value">
                  {stats.lastAt ? formatDateTime(locale, stats.lastAt) : '-'}
                </Typography.Text>
              </div>
            </div>
          </div>

          <div className="hc-repo-activity__block">
            <Typography.Text type="secondary" className="hc-repo-activity__block-title">
              {t('repos.dashboard.activity.webhook.distribution')}
            </Typography.Text>
            <div className="hc-repo-activity__dist-bar" role="img" aria-label={t('repos.dashboard.activity.webhook.distribution')}>
              {distribution.map((seg) => (
                <div
                  key={seg.key}
                  className="hc-repo-activity__dist-seg"
                  style={{
                    width: `${seg.pct}%`,
                    background: resultColor(seg.key)
                  }}
                />
              ))}
            </div>
            <div className="hc-repo-activity__legend">
              {distribution.map((seg) => (
                <div key={seg.key} className="hc-repo-activity__legend-item">
                  <span className="hc-repo-activity__legend-dot" style={{ background: resultColor(seg.key) }} aria-hidden />
                  <Typography.Text>
                    {t(`repos.webhookDeliveries.result.${seg.key}` as any)}{' '}
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
                {t('repos.dashboard.activity.webhook.volume7d')}
              </Typography.Text>
              <div className="hc-repo-activity__bars" role="img" aria-label={t('repos.dashboard.activity.webhook.volume7d')}>
                {stats.days.map((d) => {
                  const max = stats.maxDayCount || 1;
                  const heightPct = Math.round((d.count / max) * 100);
                  return (
                    <div key={d.day} className="hc-repo-activity__bar">
                      <div className="hc-repo-activity__bar-area">
                        <div
                          className="hc-repo-activity__bar-fill"
                          style={{ height: `${heightPct}%` }}
                          title={`${formatDayLabel(locale, d.day)}: ${d.count}`}
                        />
                      </div>
                      <div className="hc-repo-activity__bar-label">{formatDayLabel(locale, d.day)}</div>
                    </div>
                  );
                })}
              </div>
            </div>
        </div>
      ) : (
        <div className="hc-empty">
          <Empty description={t('repos.dashboard.activity.webhook.empty')} />
        </div>
      )}
    </Card>
  );
};
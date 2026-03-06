import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Card, Empty, Skeleton, Space, Tag, Typography } from 'antd';
import type { TaskGroup } from '../../api';
import { fetchTaskGroups } from '../../api';
import { useLocale, useT } from '../../i18n';
import { buildTaskGroupHash, buildTaskGroupsHash } from '../../router';
import { getTaskGroupKindColor, getTaskGroupKindLabel, getTaskGroupTitle } from '../../utils/taskGroup';

export interface RepoTaskGroupsCardProps {
  repoId: string;
}

const RECENT_TASK_GROUPS_LIMIT = 8; // Keep repo overview task-group list bounded for fast dashboard loads. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5

export const RepoTaskGroupsCard: FC<RepoTaskGroupsCardProps> = ({ repoId }) => {
  const locale = useLocale();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [groups, setGroups] = useState<TaskGroup[]>([]);

  const formatTime = useCallback(
    (iso: string): string => {
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const refresh = useCallback(async () => {
    // Fetch a bounded task-group window for repo overview visibility without loading the full history. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    setLoading(true);
    setLoadFailed(false);
    try {
      const { taskGroups } = await fetchTaskGroups({ repoId, limit: RECENT_TASK_GROUPS_LIMIT });
      setGroups(Array.isArray(taskGroups) ? taskGroups : []);
    } catch (err) {
      console.error(err);
      setLoadFailed(true);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [repoId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sorted = useMemo(() => {
    // Sort task groups newest-first for the repo overview list. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
    return [...groups].sort((a, b) => String(b?.updatedAt ?? '').localeCompare(String(a?.updatedAt ?? '')));
  }, [groups]);

  const openAll = useCallback(() => {
    window.location.hash = buildTaskGroupsHash({ repoId });
  }, [repoId]);

  const openGroup = useCallback((id: string) => {
    window.location.hash = buildTaskGroupHash(id);
  }, []);

  return (
    <Card
      size="small"
      title={
        <Space size={8}>
          <UnorderedListOutlined />
          <span>{t('repos.dashboard.activity.taskGroups.title')}</span>
        </Space>
      }
      className="hc-card"
      extra={
        <Space size={8}>
          <Button type="link" size="small" style={{ padding: 0 }} onClick={openAll}>
            {t('taskGroups.page.viewAll')}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>
            {t('common.refresh')}
          </Button>
        </Space>
      }
    >
      {loading && !sorted.length ? (
        // Use skeleton to avoid layout shift while task groups load. ro3ln7zex8d0wyynfj0m
        <Skeleton active title={false} paragraph={{ rows: 6, width: ['92%', '88%', '96%', '86%', '90%', '60%'] }} />
      ) : loadFailed ? (
        <Empty description={t('repos.dashboard.activity.taskGroups.loadFailed')} />
      ) : sorted.length ? (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {sorted.map((group) => {
            const title = getTaskGroupTitle(group);
            return (
              <div key={group.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <Tag color={getTaskGroupKindColor(group.kind)} style={{ marginTop: 2 }}>
                  {getTaskGroupKindLabel(t, group.kind)}
                </Tag>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, height: 'auto' }}
                    onClick={() => openGroup(group.id)}
                    title={group.id}
                  >
                    {title}
                  </Button>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {group.bindingKey || group.id} · {formatTime(group.updatedAt)}
                    </Typography.Text>
                  </div>
                </div>
              </div>
            );
          })}
        </Space>
      ) : (
        <Empty description={t('repos.dashboard.activity.taskGroups.empty')} />
      )}
    </Card>
  );
};


import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Input, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TaskGroup, TaskGroupKind } from '../api';
import { fetchTaskGroups } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskGroupHash } from '../router';
import { PageNav, type PageNavMenuAction } from '../components/nav/PageNav';
import { CardListSkeleton } from '../components/skeletons/CardListSkeleton';

/**
 * TaskGroupsPage:
 * - Business context: provide a card list view for browsing task groups outside the chat timeline.
 * - Usage: opened from the sidebar/taskgroup context to scan and jump into a group quickly.
 *
 * Change record:
 * - 2026-01-28: Added taskgroup card list page for quick navigation. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
 */

const getKindLabel = (t: ReturnType<typeof useT>, kind: TaskGroupKind): string => {
  // Normalize task group kind labels for the card list. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
  switch (kind) {
    case 'chat':
      return t('task.event.chat');
    case 'issue':
      return t('task.event.issue');
    case 'merge_request':
      return t('task.event.merge_request');
    case 'commit':
      return t('task.event.commit');
    case 'task':
      return t('taskGroups.kind.task');
    default:
      return t('taskGroups.kind.unknown');
  }
};

const getKindColor = (kind: TaskGroupKind): string | undefined => {
  // Apply consistent tag colors per task group kind for faster scanning. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
  switch (kind) {
    case 'chat':
      return 'geekblue';
    case 'issue':
      return 'gold';
    case 'merge_request':
      return 'purple';
    case 'commit':
      return 'cyan';
    case 'task':
      return 'green';
    default:
      return undefined;
  }
};

export interface TaskGroupsPageProps {
  userPanel?: ReactNode;
  navToggle?: PageNavMenuAction;
}

export const TaskGroupsPage: FC<TaskGroupsPageProps> = ({ userPanel, navToggle }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    // Fetch task groups for the card list page without blocking UI interactions. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    setLoading(true);
    try {
      const data = await fetchTaskGroups({ limit: 50 });
      setGroups(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.taskGroups.fetchFailed'));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((group) => {
      const title = String(group.title ?? '').trim();
      const repoName = group.repo?.name ?? group.repoId ?? '';
      const binding = String(group.bindingKey ?? '').trim();
      return `${title} ${repoName} ${binding} ${group.id}`.toLowerCase().includes(q);
    });
  }, [groups, search]);

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

  const openGroup = useCallback((group: TaskGroup) => {
    // Keep navigation consistent with task group chat routes from the card list. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    window.location.hash = buildTaskGroupHash(group.id);
  }, []);

  return (
    <div className="hc-page">
      <PageNav
        title={t('taskGroups.page.title')}
        meta={<Typography.Text type="secondary">{t('taskGroups.page.subtitle', { count: filtered.length })}</Typography.Text>}
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
            {t('common.refresh')}
          </Button>
        }
        // Provide the mobile nav toggle so Task Groups can open the sidebar drawer. docs/en/developer/plans/dhbg1plvf7lvamcpt546/task_plan.md dhbg1plvf7lvamcpt546
        navToggle={navToggle}
        userPanel={userPanel}
      />

      <div className="hc-page__body">
        <div className="hc-toolbar">
          <Input
            allowClear
            placeholder={t('taskGroups.page.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length ? (
          <div className="hc-card-list">
            {/* Switch taskgroup list to a responsive grid with segmented card sections. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
            <div className="hc-card-grid">
              {filtered.map((group) => {
                const title = String(group.title ?? '').trim() || group.bindingKey || group.id;
                const repoName = group.repo?.name ?? group.repoId ?? '-';
                const provider = group.repo?.provider ?? group.repoProvider;
                const providerLabel = provider === 'github' ? 'GitHub' : provider === 'gitlab' ? 'GitLab' : '';
                // Use the shared glass card style for taskgroup list items. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
                return (
                  <Card
                    key={group.id}
                    size="small"
                    hoverable
                    className="hc-taskgroup-card"
                    // Match taskgroup card padding to the refreshed list cards. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
                    styles={{ body: { padding: 14 } }}
                    onClick={() => openGroup(group)}
                  >
                    {/* Segment taskgroup card content into clear blocks for the grid layout. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                    <div className="hc-card-structure">
                      <div className="hc-card-header">
                        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                          {/* Keep long taskgroup titles from overflowing the card header. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                          <Typography.Text strong style={{ minWidth: 0 }}>
                            {title}
                          </Typography.Text>
                          <Space size={6} wrap>
                            <Tag color={getKindColor(group.kind)}>{getKindLabel(t, group.kind)}</Tag>
                            {providerLabel ? <Tag color="geekblue">{providerLabel}</Tag> : null}
                          </Space>
                        </Space>
                      </div>
                      <div className="hc-card-divider" />
                      <Space size={12} wrap className="hc-card-meta">
                        <Typography.Text type="secondary">{repoName}</Typography.Text>
                        <Typography.Text type="secondary">{group.bindingKey || group.id}</Typography.Text>
                        <Typography.Text type="secondary">{formatTime(group.updatedAt)}</Typography.Text>
                      </Space>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : loading ? (
          // Reuse the list skeleton so the empty state only appears after a real empty response. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
          <CardListSkeleton
            count={6}
            cardClassName="hc-taskgroup-card"
            layout="grid"
            testId="hc-taskgroups-skeleton"
            ariaLabel={t('common.loading')}
          />
        ) : (
          <div className="hc-empty">
            <Empty description={loading ? t('common.loading') : t('taskGroups.page.empty')} />
          </div>
        )}
      </div>
    </div>
  );
};

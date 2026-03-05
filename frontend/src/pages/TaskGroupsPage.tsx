import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Input, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TaskGroup, TaskGroupKind } from '../api';
import { fetchTaskGroups } from '../api';
import { useLocale, useT } from '../i18n';
import { buildTaskGroupHash } from '../router';
import { PageNav, type PageNavMenuAction } from '../components/nav/PageNav';
import { CardListSkeleton } from '../components/skeletons/CardListSkeleton';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

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

const TASK_GROUPS_PAGE_SIZE = 50; // Keep task-group pagination aligned with existing list limits. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227

export const TaskGroupsPage: FC<TaskGroupsPageProps> = ({ userPanel, navToggle }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<TaskGroup[]>([]);
  const [search, setSearch] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null); // Track pagination cursor for task-group load-more. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const fetchPage = useCallback(
    async (options: { cursor?: string; append: boolean }) => {
      // Fetch task groups for the card list page without blocking UI interactions. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
      if (options.append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      try {
        const params: { limit: number; cursor?: string } = { limit: TASK_GROUPS_PAGE_SIZE };
        if (options.cursor) params.cursor = options.cursor;
        const { taskGroups, nextCursor: cursor } = await fetchTaskGroups(params);
        setGroups((prev) => (options.append ? [...prev, ...taskGroups] : taskGroups));
        setNextCursor(cursor ?? null);
      } catch (err) {
        console.error(err);
        message.error(t('toast.taskGroups.fetchFailed'));
        if (!options.append) {
          setGroups([]);
          setNextCursor(null);
        }
      } finally {
        if (options.append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [message, t]
  );

  const refresh = useCallback(async () => {
    // Reset task-group pagination when users refresh the list. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    await fetchPage({ append: false });
  }, [fetchPage]);

  const loadMore = useCallback(async () => {
    // Append additional task-group pages when the sentinel is reached. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
    if (!nextCursor || loading || loadingMore) return;
    await fetchPage({ append: true, cursor: nextCursor });
  }, [fetchPage, loading, loadingMore, nextCursor]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Trigger task-group pagination when the sentinel enters view. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
  useInfiniteScroll({
    targetRef: loadMoreRef,
    enabled: Boolean(nextCursor) && !loading && !loadingMore,
    onLoadMore: () => void loadMore()
  });

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
            {/* Add an infinite-scroll sentinel to load more task groups when the list bottom is reached. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227 */}
            <div ref={loadMoreRef} data-testid="hc-taskgroups-load-more" />
            {loadingMore ? (
              <div style={{ padding: '12px 0', textAlign: 'center' }}>
                <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
              </div>
            ) : null}
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

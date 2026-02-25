// Extract provider activity row rendering helpers for reuse. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Button, Dropdown, Tag, Tooltip, Typography } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import type { RepoProviderActivityItem } from '../../api';
import { buildTaskGroupHash, buildTaskHash } from '../../router';

const shortIdFallback = (id: string): string => id.slice(0, 7);

const stateTag = (t: (key: string, vars?: any) => string, state?: string) => {
  const raw = String(state ?? '').trim().toLowerCase();
  if (!raw) return null;
  const key =
    raw === 'merged'
      ? 'repos.detail.providerActivity.state.merged'
      : raw === 'open' || raw === 'opened'
        ? 'repos.detail.providerActivity.state.open'
        : raw === 'closed'
          ? 'repos.detail.providerActivity.state.closed'
          : '';
  const label = key ? t(key as any) : raw;
  const color = raw === 'merged' ? 'green' : raw === 'open' || raw === 'opened' ? 'geekblue' : undefined;
  return <Tag color={color}>{label}</Tag>;
};

export const renderProviderActivityItem = (
  t: (key: string, vars?: any) => string,
  formatTime: (iso: string) => string,
  kind: 'commit' | 'merge' | 'issue',
  item: RepoProviderActivityItem
) => {
  // Redesign activity items as compact rows with right-aligned task-group actions. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
  const label = item.title || item.id;
  const displayId = kind === 'commit' ? String(item.shortId ?? '').trim() || shortIdFallback(item.id) : '';
  const metaTime = item.time ? formatTime(item.time) : '';

  const titleNode = item.url ? (
    <Typography.Link href={item.url} target="_blank" rel="noreferrer" className="table-cell-ellipsis" title={label}>
      {label}
    </Typography.Link>
  ) : (
    <Typography.Text className="table-cell-ellipsis" title={label}>
      {label}
    </Typography.Text>
  );

  const taskGroups = Array.isArray(item.taskGroups) ? item.taskGroups : [];
  const processingTasks = taskGroups.flatMap((g) => (Array.isArray(g.processingTasks) ? g.processingTasks : []));

  const taskGroupEntry = taskGroups.length ? (
    <Tooltip title={t('repos.detail.providerActivity.taskGroups', { count: taskGroups.length })}>
      {taskGroups.length === 1 ? (
        <Button
          size="small"
          type="text"
          icon={<UnorderedListOutlined />}
          aria-label={t('repos.detail.providerActivity.taskGroups', { count: taskGroups.length })}
          onClick={() => {
            // Navigate via the compact task-group affordance to keep activity rows short. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
            window.location.hash = buildTaskGroupHash(taskGroups[0].id);
          }}
        >
          {taskGroups.length}
        </Button>
      ) : (
        <Dropdown
          trigger={['click']}
          menu={{
            items: taskGroups.map((g) => ({ key: g.id, label: g.title || g.id })),
            onClick: ({ key }) => {
              // Offer a chooser for multiple task groups without expanding the list row. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
              window.location.hash = buildTaskGroupHash(String(key));
            }
          }}
        >
          <Button
            size="small"
            type="text"
            icon={<UnorderedListOutlined />}
            aria-label={t('repos.detail.providerActivity.taskGroups', { count: taskGroups.length })}
          >
            {taskGroups.length}
          </Button>
        </Dropdown>
      )}
    </Tooltip>
  ) : null;

  return (
    <div key={item.id} className="hc-provider-activity-item">
      <div className="hc-provider-activity-item__row">
        <div className="hc-provider-activity-item__main">
          <div className="hc-provider-activity-item__mainLine">
            {kind === 'commit' ? (
              <Typography.Text code title={item.id} style={{ fontSize: 12 }}>
                {displayId}
              </Typography.Text>
            ) : null}
            {kind !== 'commit' ? stateTag(t, item.state) : null}
            <div className="hc-provider-activity-item__titleWrap">{titleNode}</div>
            {kind !== 'commit' && metaTime ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('repos.detail.providerActivity.updatedAt', { time: metaTime })}
              </Typography.Text>
            ) : null}
          </div>
        </div>

        {taskGroupEntry ? <div className="hc-provider-activity-item__side">{taskGroupEntry}</div> : null}
      </div>

      {processingTasks.length ? (
        <div style={{ marginTop: 2 }}>
          <Tag color="gold">{t('repos.detail.providerActivity.processing', { count: processingTasks.length })}</Tag>
          {processingTasks.slice(0, 1).map((task) => (
            <Button
              key={task.id}
              size="small"
              type="link"
              onClick={() => {
                window.location.hash = buildTaskHash(task.id);
              }}
            >
              {task.title || task.id}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

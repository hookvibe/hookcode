import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, App, Avatar, Button, Card, Col, Descriptions, Empty, Popconfirm, Row, Space, Steps, Tag, Typography } from 'antd';
import {
  ClockCircleOutlined,
  CodeOutlined,
  DeleteOutlined,
  GitlabOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  PlayCircleOutlined,
  RobotOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { Task, TaskRepoSummary, TaskRobotSummary } from '../api';
import { deleteTask, fetchTask, retryTask } from '../api';
import { useLocale, useT } from '../i18n';
import { buildRepoHash, buildTaskGroupHash, buildTasksHash } from '../router';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { TaskLogViewer } from '../components/TaskLogViewer';
import { PageNav } from '../components/nav/PageNav';
import { getPrevHashForBack, isInAppHash } from '../navHistory';
import {
  eventTag,
  extractTargetLink,
  extractUser,
  extractTaskResultText,
  formatRef,
  getTaskTitle,
  isTerminalStatus,
  queuedHintText,
  statusTag
} from '../utils/task';
import { buildTaskTemplateContext, renderTemplate } from '../utils/template';
import { LogViewerSkeleton } from '../components/skeletons/LogViewerSkeleton';
import { TaskDetailSkeleton } from '../components/skeletons/TaskDetailSkeleton';

/**
 * TaskDetailPage:
 * - Business context: inspect a single task execution (metadata, retry/delete controls, logs, and output).
 * - Module: `frontend-chat` migration (Tasks).
 *
 * Key behaviors:
 * - Load task by id.
 * - Allow manage actions (retry / force retry / delete) when `task.permissions.canManage`.
 * - Provide deep links to repo detail (and optional robot focus) and to task group chat.
 *
 * Change record:
 * - 2026-01-12: Migrated legacy task detail capabilities into `frontend-chat`.
 * - 2026-01-12: Remove header refresh button to keep the PageNav actions focused on task-specific operations.
 * - 2026-01-12: Add the top "Repository / Robot / Author" cards to match the legacy frontend task detail layout.
 */

export interface TaskDetailPageProps {
  taskId: string;
  userPanel?: ReactNode;
  taskLogsEnabled?: boolean | null;
}

const providerLabel = (provider: string) => (provider === 'github' ? 'GitHub' : 'GitLab');

export const TaskDetailPage: FC<TaskDetailPageProps> = ({ taskId, userPanel, taskLogsEnabled }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState<Task | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const data = await fetchTask(taskId);
      setTask(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.task.fetchFailed'));
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [message, t, taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const formatDateTime = useCallback(
    (iso: string) => {
      if (!iso) return '-';
      try {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return iso;
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'medium' }).format(date);
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const canManageTask = Boolean(task?.permissions?.canManage);
  const canOpenRepo = Boolean(task?.repo?.id ?? task?.repoId);
  const canOpenGroup = Boolean(task?.groupId);
  const effectiveTaskLogsEnabled = taskLogsEnabled === undefined ? true : taskLogsEnabled; // Guard Live logs rendering with backend feature flags to avoid 404 reconnect loops. 0nazpc53wnvljv5yh7c6

  const repoSummary = useMemo<TaskRepoSummary | null>(() => {
    if (!task) return null;
    if (task.repo) return task.repo;
    if (task.repoId && task.repoProvider) {
      return { id: task.repoId, provider: task.repoProvider, name: task.repoId, enabled: true };
    }
    return null;
  }, [task]);

  const robotSummary = useMemo<TaskRobotSummary | null>(() => {
    if (!task) return null;
    if (task.robot) return task.robot;
    if (task.robotId) {
      return { id: task.robotId, repoId: task.repoId ?? '', name: task.robotId, permission: 'read', enabled: true };
    }
    return null;
  }, [task]);

  const repoDetailHref = useMemo(() => {
    const repoIdResolved = task?.repo?.id ?? task?.repoId;
    if (!repoIdResolved) return '';
    const qs = new URLSearchParams();
    qs.set('from', 'task');
    qs.set('taskId', taskId);
    return `#/repos/${encodeURIComponent(repoIdResolved)}?${qs.toString()}`;
  }, [task?.repo?.id, task?.repoId, taskId]);

  const robotDetailHref = useMemo(() => {
    const repoIdResolved = task?.repo?.id ?? task?.repoId;
    const robotIdResolved = task?.robot?.id ?? task?.robotId;
    if (!repoIdResolved || !robotIdResolved) return '';
    const qs = new URLSearchParams();
    qs.set('from', 'task');
    qs.set('taskId', taskId);
    qs.set('robotId', robotIdResolved);
    return `#/repos/${encodeURIComponent(repoIdResolved)}?${qs.toString()}`;
  }, [task?.repo?.id, task?.repoId, task?.robot?.id, task?.robotId, taskId]);

  const providerCommentUrl = useMemo(() => {
    const raw = task?.result?.providerCommentUrl;
    if (typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    return trimmed ? trimmed : '';
  }, [task?.result?.providerCommentUrl]);

  const tokenUsage = useMemo(() => {
    const raw = task?.result?.tokenUsage as any;
    if (!raw) return null;
    const inputTokens = typeof raw.inputTokens === 'number' && Number.isFinite(raw.inputTokens) ? raw.inputTokens : 0;
    const outputTokens = typeof raw.outputTokens === 'number' && Number.isFinite(raw.outputTokens) ? raw.outputTokens : 0;
    const totalTokens = typeof raw.totalTokens === 'number' && Number.isFinite(raw.totalTokens) ? raw.totalTokens : inputTokens + outputTokens;
    if (inputTokens <= 0 && outputTokens <= 0 && totalTokens <= 0) return null;
    return { inputTokens, outputTokens, totalTokens };
  }, [task?.result?.tokenUsage]);

  const repoWorkflow = useMemo(() => {
    // Display direct-vs-fork repo workflow metadata from the agent for debugging and clarity. 24yz61mdik7tqdgaa152
    const raw = (task?.result as any)?.repoWorkflow;
    if (!raw || typeof raw !== 'object') return null;
    const mode = typeof (raw as any).mode === 'string' ? String((raw as any).mode).trim() : '';
    if (mode !== 'direct' && mode !== 'fork') return null;

    const upstream = (raw as any).upstream && typeof (raw as any).upstream === 'object' ? (raw as any).upstream : null;
    const fork = (raw as any).fork && typeof (raw as any).fork === 'object' ? (raw as any).fork : null;
    const upstreamWebUrl = upstream && typeof upstream.webUrl === 'string' ? upstream.webUrl.trim() : '';
    const forkWebUrl = fork && typeof fork.webUrl === 'string' ? fork.webUrl.trim() : '';

    return {
      mode,
      upstreamSlug: upstream && typeof upstream.slug === 'string' ? upstream.slug.trim() : '',
      forkSlug: fork && typeof fork.slug === 'string' ? fork.slug.trim() : '',
      upstreamWebUrl: upstreamWebUrl || '',
      forkWebUrl: forkWebUrl || ''
    };
  }, [task?.result]);

  const resultText = useMemo(() => extractTaskResultText(task), [task]);
  const showResult = Boolean(task && isTerminalStatus(task.status));
  const queueHint = useMemo(() => queuedHintText(t, task), [t, task]); // Show a queued-state explanation instead of a silent detail page. f3a9c2d8e1b7f4a0c6d1

  const payloadPretty = useMemo(() => {
    // Format raw payload for display without assuming the payload is always JSON-serializable. tdlayout20260117k8p3
    if (!task?.payload) return '';
    try {
      return JSON.stringify(task.payload ?? {}, null, 2);
    } catch {
      try {
        return String(task.payload);
      } catch {
        return '';
      }
    }
  }, [task?.payload]);

  const promptPatch = useMemo(() => {
    // Normalize prompt patch (repo config) so the workflow UI can always render a stable section. tdlayout20260117k8p3
    const raw = task?.promptCustom;
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }, [task?.promptCustom]);

  const promptPatchRendered = useMemo(() => {
    // Render prompt patch variables against the task payload so users can debug templates. x0kprszlsorw9vi8jih9
    if (!task || !promptPatch) return '';
    return renderTemplate(promptPatch, buildTaskTemplateContext(task));
  }, [promptPatch, task]);

  const workflowSteps = useMemo(() => {
    // Render the workflow as Steps with bottom-up numbering while keeping Result at the top. tdstepsreverse20260117k1p6
    const items = [
      {
        key: 'result',
        title: t('task.page.resultTitle'),
        content: (
          <Card size="small" className="hc-card">
            {showResult ? (
              resultText ? (
                <MarkdownViewer markdown={resultText} className="markdown-result--expanded" />
              ) : (
                <Typography.Text type="secondary">{t('chat.message.resultEmpty')}</Typography.Text>
              )
            ) : (
              <Typography.Text type="secondary">{t('task.page.resultPending')}</Typography.Text>
            )}
          </Card>
        )
      },
      {
        key: 'logs',
        title: t('task.page.logsTitle'),
        content: (
          <Card size="small" className="hc-card">
            {/* Render the logs viewer only when logs are enabled to prevent endless SSE reconnects. 0nazpc53wnvljv5yh7c6 */}
            {effectiveTaskLogsEnabled === false ? (
              <Alert type="info" showIcon message={t('logViewer.disabled')} />
            ) : effectiveTaskLogsEnabled === null ? (
              <>
                {/* Show a log-shaped skeleton while the logs feature gate is still loading. ro3ln7zex8d0wyynfj0m */}
                <LogViewerSkeleton lines={10} ariaLabel={t('common.loading')} />
              </>
            ) : task ? (
              <TaskLogViewer taskId={task.id} canManage={Boolean(task.permissions?.canManage)} height={360} tail={800} />
            ) : null}
          </Card>
        )
      },
      {
        key: 'prompt',
        title: t('tasks.promptCustom'),
        content: (
          <Card size="small" className="hc-card">
            {promptPatch ? (
              <Row gutter={[12, 12]}>
                <Col xs={24} lg={12} style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary">{t('tasks.promptCustom.raw')}</Typography.Text>
                  <pre className="hc-task-code-block">{promptPatch}</pre>
                </Col>
                <Col xs={24} lg={12} style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary">{t('tasks.promptCustom.rendered')}</Typography.Text>
                  <pre className="hc-task-code-block">{promptPatchRendered}</pre>
                </Col>
              </Row>
            ) : (
              <Typography.Text type="secondary">-</Typography.Text>
            )}
          </Card>
        )
      },
      {
        key: 'payload',
        title: t('tasks.payloadRaw'),
        content: (
          <Card size="small" className="hc-card">
            {payloadPretty ? <pre className="hc-task-code-block">{payloadPretty}</pre> : <Typography.Text type="secondary">-</Typography.Text>}
          </Card>
        )
      }
    ] as const;

    return items.map((item, idx) => ({
      ...item,
      icon: <span className="hc-step-index">{items.length - idx}</span>
    }));
  }, [effectiveTaskLogsEnabled, payloadPretty, promptPatch, promptPatchRendered, resultText, showResult, t, task]);

  const handleRetry = useCallback(
    async (options?: { force?: boolean }) => {
      if (!task) return;
      if (!task.permissions?.canManage) {
        message.warning(t('tasks.empty.noPermission'));
        return;
      }
      setRetrying(true);
      try {
        await retryTask(task.id, options);
        message.success(options?.force ? t('toast.task.forceRetrySuccess') : t('toast.task.retrySuccess'));
        await refresh();
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 409) {
          message.warning(t('toast.task.retryBlockedProcessing'));
          return;
        }
        console.error(err);
        message.error(t('toast.task.retryFailedTasksFailed'));
      } finally {
        setRetrying(false);
      }
    },
    [message, refresh, t, task]
  );

  const handleDelete = useCallback(async () => {
    if (!task) return;
    if (!task.permissions?.canManage) {
      message.warning(t('tasks.empty.noPermission'));
      return;
    }
    setDeleting(true);
    try {
      await deleteTask(task.id);
      message.success(t('toast.task.deleted'));
      // Navigation note: fall back to task list after delete.
      window.location.hash = '#/tasks';
    } catch (err) {
      console.error(err);
      message.error(t('toast.task.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  }, [message, t, task]);

  if (!taskId) {
    return (
      <div className="hc-page">
        <div className="hc-empty">
          <Empty description={t('task.page.missingId')} />
        </div>
      </div>
    );
  }

  const headerActions = task ? (
    <Space size={8}>
      {task.status === 'queued' && canManageTask ? (
        <Button icon={<PlayCircleOutlined />} onClick={() => void handleRetry()} loading={retrying}>
          {t('tasks.retry')}
        </Button>
      ) : null}

      {task.status === 'failed' && canManageTask ? (
        <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => void handleRetry()} loading={retrying}>
          {t('tasks.retry')}
        </Button>
      ) : null}

      {task.status === 'processing' && canManageTask ? (
        <Popconfirm
          title={t('tasks.forceRetry.confirmTitle')}
          okText={t('tasks.forceRetry')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleRetry({ force: true })}
        >
          <Button danger icon={<PlayCircleOutlined />} loading={retrying}>
            {t('tasks.forceRetry')}
          </Button>
        </Popconfirm>
      ) : null}

      {canManageTask ? (
        <Popconfirm
          title={t('tasks.delete.confirmTitle')}
          okText={t('common.delete')}
          cancelText={t('common.cancel')}
          onConfirm={() => void handleDelete()}
        >
          <Button danger icon={<DeleteOutlined />} loading={deleting}>
            {t('common.delete')}
          </Button>
        </Popconfirm>
      ) : null}
    </Space>
  ) : undefined;

  const user = task ? extractUser(task.payload) : undefined;
  const target = task ? extractTargetLink(t, task) : undefined;

  const headerBack = useMemo(() => {
    // Header back behavior:
    // - Module: Frontend Chat / Tasks.
    // - Business intent: match legacy frontend "header back icon" rules.
    // - Key steps:
    //   1) Prefer going back to the previous in-app hash (when safe).
    //   2) If there is no safe previous hash (e.g. opened from sidebar or deep-linked), fall back to `#/tasks`.
    // - Change record: 2026-01-12 - Introduce header back for task detail and reuse the shared nav-history helper.
    return {
      ariaLabel: t('common.backToList'),
      onClick: () => {
        if (typeof window === 'undefined') return;
        const currentHash = String(window.location.hash ?? '');
        const prevHash = String(getPrevHashForBack() ?? '');
        if (isInAppHash(prevHash) && prevHash !== currentHash) {
          window.history.back();
          return;
        }
        window.location.hash = buildTasksHash();
      }
    };
  }, [t]);

  return (
    <div className="hc-page hc-task-detail-page">
      {/* Redesign the task detail view to full-width with a summary strip and Steps-connected workflow. tdlayout20260117k8p3 */}
      <PageNav
        back={headerBack}
        title={task ? getTaskTitle(task) : t('task.page.title')}
        meta={
          task ? (
            <Space size={10}>
              {statusTag(t, task.status)}
              <Typography.Text type="secondary">{repoSummary?.name ?? task.repoId ?? '-'}</Typography.Text>
              <Typography.Text type="secondary">{t('task.page.updatedAt', { time: formatDateTime(task.updatedAt) })}</Typography.Text>
            </Space>
          ) : undefined
        }
        actions={headerActions}
        userPanel={userPanel}
      />

      {task ? (
        <div className="hc-task-summary-strip">
          <div className="hc-task-summary-strip__scroller">
            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  {repoSummary?.provider === 'gitlab' ? <GitlabOutlined style={{ fontSize: 16 }} /> : <CodeOutlined style={{ fontSize: 16 }} />}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.repo')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {repoSummary ? (
                      <Space size={8} wrap>
                        <Tag color={repoSummary.provider === 'github' ? 'geekblue' : 'orange'}>{providerLabel(repoSummary.provider)}</Tag>
                        <Typography.Link onClick={() => (window.location.hash = repoDetailHref || buildRepoHash(repoSummary.id))}>
                          {repoSummary.name}
                        </Typography.Link>
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <RobotOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.robot')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {robotSummary ? (
                      <Space size={8} wrap>
                        <Tag color={robotSummary.permission === 'write' ? 'volcano' : 'blue'}>{robotSummary.permission}</Tag>
                        {robotDetailHref ? (
                          <Typography.Link href={robotDetailHref}>{robotSummary.name || robotSummary.id}</Typography.Link>
                        ) : (
                          <Typography.Text>{robotSummary.name || robotSummary.id}</Typography.Text>
                        )}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  {user?.avatar ? (
                    <Avatar src={user.avatar} size={24} style={{ borderRadius: 6 }}>
                      {String(user.name || user.username || '?').slice(0, 1)}
                    </Avatar>
                  ) : (
                    <UserOutlined style={{ fontSize: 16 }} />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.author')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {user ? (
                      <Space size={6} wrap>
                        <Typography.Text>{String(user.name || user.username || '-').trim()}</Typography.Text>
                        {user.username ? <Typography.Text type="secondary"> @{user.username}</Typography.Text> : null}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <InfoCircleOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.status')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    <Space size={6} wrap>
                      {statusTag(t, task.status)}
                      {eventTag(t, task.eventType)}
                    </Space>
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <LinkOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.target')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    {target ? (
                      <Typography.Link href={target.href} target="_blank" rel="noreferrer">
                        {target.text}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </div>
                </div>
              </Space>
            </div>

            <div className="hc-task-meta__card hc-task-summary-strip__card">
              <Space size={12} align="start">
                <div className="hc-task-meta__icon" aria-hidden>
                  <ClockCircleOutlined style={{ fontSize: 16 }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text type="secondary" className="hc-task-meta__label">
                    {t('tasks.field.updatedAt')}
                  </Typography.Text>
                  <div className="hc-task-meta__value">
                    <Space orientation="vertical" size={2}>
                      <Typography.Text>{formatDateTime(task.updatedAt)}</Typography.Text>
                      {/* <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {t('tasks.field.createdAt')}: {formatDateTime(task.createdAt)}
                      </Typography.Text> */}
                    </Space>
                  </div>
                </div>
              </Space>
            </div>
          </div>
        </div>
      ) : null}

      <div className="hc-page__body">
        {task?.status === 'queued' && queueHint ? (
          /* Display queue diagnosis so the detail page is not silent while waiting. f3a9c2d8e1b7f4a0c6d1 */
          <Alert type="info" showIcon title={t('tasks.queue.hintTitle')} description={queueHint} style={{ marginBottom: 12 }} />
        ) : null}
        {task ? (
          <div className="hc-task-detail-layout">
            <div className="hc-task-detail-sidebar">
              <Card size="small" title={t('tasks.detailTitle')} className="hc-card">
                <Descriptions column={1} size="small" styles={{ label: { width: 132 } }}>
                  <Descriptions.Item label={t('tasks.field.repo')}>
                    {repoSummary ? (
                      <Space size={8} wrap>
                        <Tag color={repoSummary.provider === 'github' ? 'geekblue' : 'orange'}>{providerLabel(repoSummary.provider)}</Tag>
                        <Typography.Link onClick={() => (window.location.hash = repoDetailHref || buildRepoHash(repoSummary.id))}>
                          {repoSummary.name}
                        </Typography.Link>
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.robot')}>
                    {robotSummary ? (
                      <Space size={8} wrap>
                        <Tag color={robotSummary.permission === 'write' ? 'volcano' : 'blue'}>{robotSummary.permission}</Tag>
                        {robotDetailHref ? (
                          <Typography.Link href={robotDetailHref}>{robotSummary.name || robotSummary.id}</Typography.Link>
                        ) : (
                          <Typography.Text>{robotSummary.name || robotSummary.id}</Typography.Text>
                        )}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  {repoWorkflow ? (
                    <Descriptions.Item label={t('tasks.field.repoWorkflow')}>
                      <Space size={8} wrap>
                        <Tag color={repoWorkflow.mode === 'fork' ? 'purple' : 'green'}>
                          {repoWorkflow.mode === 'fork' ? t('tasks.repoWorkflow.fork') : t('tasks.repoWorkflow.direct')}
                        </Tag>

                        {repoWorkflow.upstreamWebUrl ? (
                          <Typography.Link href={repoWorkflow.upstreamWebUrl} target="_blank" rel="noreferrer">
                            {repoWorkflow.upstreamSlug || repoWorkflow.upstreamWebUrl}
                          </Typography.Link>
                        ) : repoWorkflow.upstreamSlug ? (
                          <Typography.Text>{repoWorkflow.upstreamSlug}</Typography.Text>
                        ) : null}

                        {repoWorkflow.mode === 'fork' ? (
                          repoWorkflow.forkWebUrl ? (
                            <Typography.Link href={repoWorkflow.forkWebUrl} target="_blank" rel="noreferrer">
                              {repoWorkflow.forkSlug || repoWorkflow.forkWebUrl}
                            </Typography.Link>
                          ) : repoWorkflow.forkSlug ? (
                            <Typography.Text type="secondary">{repoWorkflow.forkSlug}</Typography.Text>
                          ) : null
                        ) : null}
                      </Space>
                    </Descriptions.Item>
                  ) : null}

                  <Descriptions.Item label={t('tasks.field.author')}>
                    {user ? (
                      <Space size={6} wrap>
                        <Typography.Text>{String(user.name || user.username || '-').trim()}</Typography.Text>
                        {user.username ? <Typography.Text type="secondary"> @{user.username}</Typography.Text> : null}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.event')}>{eventTag(t, task.eventType)}</Descriptions.Item>
                  <Descriptions.Item label={t('tasks.field.status')}>{statusTag(t, task.status)}</Descriptions.Item>
                  <Descriptions.Item label={t('tasks.field.title')}>{task.title || '-'}</Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.group')}>
                    {canOpenGroup ? (
                      <Typography.Link onClick={() => (window.location.hash = buildTaskGroupHash(String(task.groupId)))}>
                        {String(task.groupId)}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.target')}>
                    {target ? (
                      <Typography.Link href={target.href} target="_blank" rel="noreferrer">
                        {target.text}
                      </Typography.Link>
                    ) : (
                      <Typography.Text type="secondary">-</Typography.Text>
                    )}
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.ref')}>
                    <Typography.Text>{formatRef(task.ref) || '-'}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.retries')}>
                    <Typography.Text>{String(task.retries ?? 0)}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.createdAt')}>
                    <Typography.Text>{formatDateTime(task.createdAt)}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.updatedAt')}>
                    <Typography.Text>{formatDateTime(task.updatedAt)}</Typography.Text>
                  </Descriptions.Item>

                  <Descriptions.Item label={t('tasks.field.id')}>
                    <Typography.Text code>{task.id}</Typography.Text>
                  </Descriptions.Item>

                  {providerCommentUrl ? (
                    <Descriptions.Item label={t('tasks.field.providerComment')}>
                      <Typography.Link href={providerCommentUrl} target="_blank" rel="noreferrer">
                        {t('tasks.openProviderComment')}
                      </Typography.Link>
                    </Descriptions.Item>
                  ) : null}

                  {tokenUsage ? (
                    <Descriptions.Item label={t('tasks.field.tokens')}>
                      <Typography.Text>
                        {t('tasks.tokens.format', {
                          input: tokenUsage.inputTokens,
                          output: tokenUsage.outputTokens,
                          total: tokenUsage.totalTokens
                        })}
                      </Typography.Text>
                    </Descriptions.Item>
                  ) : null}
                </Descriptions>

                {!canOpenRepo ? (
                  <Alert type="info" showIcon message={t('tasks.repoMissing')} style={{ marginTop: 12 }} />
                ) : null}
              </Card>
            </div>

            <div className="hc-task-detail-workflow">
              <Steps
                className="hc-task-workflow"
                orientation="vertical"
                size="small"
                current={0}
                items={workflowSteps}
              />
            </div>
          </div>
        ) : loading ? (
          // Render a task-detail skeleton instead of a generic Empty+icon while loading. ro3ln7zex8d0wyynfj0m
          <TaskDetailSkeleton testId="hc-task-detail-skeleton" ariaLabel={t('common.loading')} />
        ) : (
          <div className="hc-empty">
            <Empty description={t('task.page.notFound')} />
          </div>
        )}
      </div>
    </div>
  );
};

import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Alert, App, Avatar, Button, Card, Col, Collapse, Descriptions, Empty, Popconfirm, Row, Space, Tag, Typography } from 'antd';
import { CodeOutlined, DeleteOutlined, GitlabOutlined, PlayCircleOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons';
import type { Task, TaskRepoSummary, TaskRobotSummary } from '../api';
import { deleteTask, fetchTask, retryTask } from '../api';
import { useLocale, useT } from '../i18n';
import { buildRepoHash, buildTaskGroupHash, buildTasksHash } from '../router';
import { MarkdownViewer } from '../components/MarkdownViewer';
import { TaskLogViewer } from '../components/TaskLogViewer';
import { PageNav } from '../components/nav/PageNav';
import { getPrevHashForBack, isInAppHash } from '../navHistory';
import { eventTag, extractTargetLink, extractUser, extractTaskResultText, formatRef, getTaskTitle, isTerminalStatus, statusTag } from '../utils/task';

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

  const resultText = useMemo(() => extractTaskResultText(task), [task]);
  const showResult = Boolean(task && isTerminalStatus(task.status));

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
    <div className="hc-page">
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

      <div className="hc-page__body">
        {task ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Card size="small" title={t('tasks.detailTitle')} className="hc-card">
              {/* Business intent (Tasks / Detail): mirror the legacy task detail top summary cards for quick scanning. */}
              <Row gutter={[14, 14]} className="hc-task-meta">
                <Col xs={24} md={8}>
                  <div className="hc-task-meta__card">
                    <Space size={12} align="start">
                      <div className="hc-task-meta__icon" aria-hidden>
                        {repoSummary?.provider === 'gitlab' ? (
                          <GitlabOutlined style={{ fontSize: 16 }} />
                        ) : (
                          <CodeOutlined style={{ fontSize: 16 }} />
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <Typography.Text type="secondary" className="hc-task-meta__label">
                          {t('tasks.field.repo')}
                        </Typography.Text>
                        <div className="hc-task-meta__value">
                          {repoSummary ? (
                            <Space size={8} wrap>
                              <Tag color={repoSummary.provider === 'github' ? 'geekblue' : 'orange'}>
                                {providerLabel(repoSummary.provider)}
                              </Tag>
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
                </Col>

                <Col xs={24} md={8}>
                  <div className="hc-task-meta__card">
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
                </Col>

                <Col xs={24} md={8}>
                  <div className="hc-task-meta__card">
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
                </Col>
              </Row>

              <Descriptions column={1} size="small" styles={{ label: { width: 140 } }}>
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

            <Card size="small" title={t('task.page.logsTitle')} className="hc-card">
              {/* Render the logs viewer only when logs are enabled to prevent endless SSE reconnects. 0nazpc53wnvljv5yh7c6 */}
              {effectiveTaskLogsEnabled === false ? (
                <Alert type="info" showIcon message={t('logViewer.disabled')} />
              ) : effectiveTaskLogsEnabled === null ? (
                <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
              ) : (
                <TaskLogViewer
                  taskId={task.id}
                  canManage={Boolean(task.permissions?.canManage)}
                  height={360}
                  tail={800}
                />
              )}
            </Card>

            <Card size="small" title={t('task.page.resultTitle')} className="hc-card">
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

            <Card size="small" title={t('tasks.payloadTitle')} className="hc-card">
              <Collapse
                defaultActiveKey={[]}
                items={[
                  ...(task.promptCustom && String(task.promptCustom).trim()
                    ? [
                        {
                          key: 'promptCustom',
                          label: t('tasks.promptCustom'),
                          children: (
                            <Typography.Paragraph style={{ marginBottom: 0 }}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{String(task.promptCustom)}</pre>
                            </Typography.Paragraph>
                          )
                        }
                      ]
                    : []),
                  {
                    key: 'payload',
                    label: t('tasks.payloadRaw'),
                    children: (
                      <Typography.Paragraph style={{ marginBottom: 0 }}>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {JSON.stringify(task.payload ?? {}, null, 2)}
                        </pre>
                      </Typography.Paragraph>
                    )
                  }
                ]}
              />
            </Card>
          </Space>
        ) : (
          <div className="hc-empty">
            <Empty description={loading ? t('common.loading') : t('task.page.notFound')} />
          </div>
        )}
      </div>
    </div>
  );
};

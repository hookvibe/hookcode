import { useMemo, useState, type MouseEvent } from 'react';
import { Alert, Button, Card, Input, Popconfirm, Space, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  InsertRowAboveOutlined,
  ReloadOutlined,
  SaveOutlined,
  StopOutlined
} from '@ant-design/icons';
import type { Task } from '../../api';
import { useLocale, useT } from '../../i18n';
import {
  eventTag,
  extractTargetLink,
  extractTaskTokenUsage,
  extractTaskUserText,
  getTaskEventMarker,
  getTaskRepoName,
  getTaskTitle,
  queuedHintText,
  statusTag
} from '../../utils/task';
import { formatDateTime } from '../../utils/dateUtc';
import { formatRobotLabelWithProvider } from '../../utils/robot';
import { TaskGitWorkspaceSummaryCard } from '../tasks/TaskGitWorkspaceSummaryCard';
import { TaskProviderRoutingPanel } from '../tasks/TaskProviderRoutingPanel';
import { MarkdownViewer } from '../MarkdownViewer';
import { WorkerSummaryTag } from '../workers/WorkerSummaryTag';
import { ApprovalRequestPanel } from '../approvals/ApprovalRequestPanel';

interface TaskGroupTaskCardProps {
  task: Task;
  onOpenLogs: (task: Task) => void;
  onRetry: (task: Task) => void;
  onStop: (task: Task) => void;
  onDelete: (task: Task) => void;
  onReorder: (task: Task, action: 'move_earlier' | 'move_later' | 'insert_next') => void;
  onSaveEdit: (task: Task, text: string) => Promise<void>;
  onApprovalUpdated: (task: Task) => Promise<void>;
  actionLoading?: string | null;
}

export const TaskGroupTaskCard = ({
  task,
  onOpenLogs,
  onRetry,
  onStop,
  onDelete,
  onReorder,
  onSaveEdit,
  onApprovalUpdated,
  actionLoading
}: TaskGroupTaskCardProps) => {
  const locale = useLocale();
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState('');

  const userText = useMemo(() => extractTaskUserText(task) || t('chat.message.userTextFallback'), [t, task]);
  const title = useMemo(() => getTaskTitle(task), [task]);
  const eventMarker = useMemo(() => getTaskEventMarker(task), [task]);
  const repoName = useMemo(() => getTaskRepoName(task), [task]);
  const robotName = useMemo(() => {
    const raw = String(task.robot?.name ?? task.robotId ?? '').trim();
    if (!raw) return '';
    return formatRobotLabelWithProvider(raw, task.robot?.modelProvider ?? null);
  }, [task.robot?.modelProvider, task.robot?.name, task.robotId]);
  const queueHint = useMemo(() => queuedHintText(t, task), [t, task]);
  const tokenUsage = useMemo(() => extractTaskTokenUsage(task), [task]);
  const createdAt = useMemo(() => formatDateTime(locale, task.createdAt), [locale, task.createdAt]);
  const updatedAt = useMemo(() => formatDateTime(locale, task.updatedAt), [locale, task.updatedAt]);
  const targetLink = useMemo(() => extractTargetLink(t, task), [t, task]);
  const summaryMarkdown = useMemo(() => String(task.result?.summary ?? task.result?.message ?? '').trim(), [task.result?.message, task.result?.summary]);
  const canManage = Boolean(task.permissions?.canManage);
  const isQueued = task.status === 'queued';
  const isProcessing = task.status === 'processing';
  const sequenceOrder = task.sequence?.order ?? task.groupOrder ?? null;
  const showConnectorTop = Boolean(task.sequence?.previousTaskId);
  const showConnectorBottom = Boolean(task.sequence?.nextTaskId);
  const busy = actionLoading ?? '';
  const manuallyStopped = task.result?.stopReason === 'manual_stop';

  const stopCardClick = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
  };

  const startEditing = (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    // Seed queued-task edits from the latest visible prompt so users can adjust work before execution. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    setDraftText(userText);
    setEditing(true);
  };

  const cancelEditing = (event: MouseEvent<HTMLElement>) => {
    // Keep queued-card editing local so card clicks still open the log workspace outside edit mode. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
    event.stopPropagation();
    setEditing(false);
    setDraftText(userText);
  };

  const saveEdit = async (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    if (!draftText.trim()) return;
    await onSaveEdit(task, draftText.trim());
    setEditing(false);
  };

  return (
    <div
      className={`hc-task-workspace-item${showConnectorTop ? ' hc-task-workspace-item--connected-top' : ''}${showConnectorBottom ? ' hc-task-workspace-item--connected-bottom' : ''}`}
    >
      <Card
        hoverable
        onClick={() => onOpenLogs(task)}
        className="hc-task-workspace-card hc-task-workspace-card--interactive"
        styles={{ body: { padding: 20 } }}
        title={
          <div className="hc-task-workspace-card__title">
            <div className="hc-task-workspace-card__title-main">
              {sequenceOrder ? <span className="hc-task-workspace-card__order">#{sequenceOrder}</span> : null}
              {/* Keep long task titles from squeezing the status area by letting the headline shrink within the card header. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
              <span className="hc-task-workspace-card__headline" title={title}>{title}</span>
            </div>
            <Space size={8} wrap className="hc-task-workspace-card__title-tags">
              {eventTag(t, task.eventType)}
              {statusTag(t, task.status)}
              {/* Keep each task card tagged with its worker so shared workspaces remain debuggable. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
              <WorkerSummaryTag worker={task.workerSummary} workerId={task.workerId} />
            </Space>
          </div>
        }
      >
        {/* Use the current Ant Design Space orientation API so queue cards do not emit runtime deprecation warnings. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <div className="hc-task-workspace-card__meta-row">
            <div className="hc-task-workspace-card__meta-grid">
              <span>{t('taskGroup.workspace.eventMarker', { value: eventMarker || '-' })}</span>
              <span>{t('taskGroup.workspace.repo', { value: repoName || '-' })}</span>
              <span>{t('taskGroup.workspace.robot', { value: robotName || '-' })}</span>
              <span>{t('taskGroup.workspace.worker', { value: task.workerSummary?.name || task.workerId || '-' })}</span>
              <span>{t('taskGroup.workspace.createdAt', { value: createdAt })}</span>
              <span>{t('taskGroup.workspace.updatedAt', { value: updatedAt })}</span>
              {tokenUsage ? (
                <span>
                  {t('tasks.tokens.format', {
                    input: new Intl.NumberFormat(locale).format(tokenUsage.inputTokens),
                    output: new Intl.NumberFormat(locale).format(tokenUsage.outputTokens),
                    total: new Intl.NumberFormat(locale).format(tokenUsage.totalTokens)
                  })}
                </span>
              ) : null}
            </div>
            {targetLink ? (
              <a className="hc-task-workspace-card__target" href={targetLink.href} target="_blank" rel="noreferrer" onClick={stopCardClick}>
                {targetLink.text}
              </a>
            ) : null}
          </div>

          {queueHint ? <Alert type="info" showIcon message={queueHint} /> : null}
          {manuallyStopped ? <Alert type="warning" showIcon message={t('taskGroup.workspace.manualStop')} /> : null}
          {task.approvalRequest ? (
            <div onClick={stopCardClick}>
              <ApprovalRequestPanel
                approval={task.approvalRequest}
                task={task}
                variant="compact"
                canManage={canManage}
                onUpdated={() => onApprovalUpdated(task)}
              />
            </div>
          ) : null}

          <div className="hc-task-workspace-card__content" onClick={editing ? stopCardClick : undefined}>
            <Typography.Text type="secondary">{t('taskGroup.workspace.request')}</Typography.Text>
            {editing ? (
              <Input.TextArea
                value={draftText}
                onChange={(event) => setDraftText(event.target.value)}
                onClick={stopCardClick}
                autoSize={{ minRows: 3, maxRows: 8 }}
                placeholder={t('taskGroup.workspace.editPlaceholder')}
              />
            ) : (
              <>
                {/* Render the submitted task body as Markdown so line breaks, lists, and code blocks stay faithful to the original prompt. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
                <MarkdownViewer markdown={userText} className="markdown-result--expanded hc-task-workspace-card__markdown" />
              </>
            )}
          </div>

          {summaryMarkdown ? (
            <div className="hc-task-workspace-card__summary">
              <Typography.Text type="secondary">{t('taskGroup.workspace.summary')}</Typography.Text>
              {/* Render task summaries as Markdown so execution formatting matches the backend-generated result text. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
              <MarkdownViewer markdown={summaryMarkdown} className="markdown-result--expanded hc-task-workspace-card__markdown" />
            </div>
          ) : null}

          {task.result?.providerRouting ? <TaskProviderRoutingPanel task={task} variant="compact" /> : null}
          <TaskGitWorkspaceSummaryCard
            task={task}
            onOpen={() => onOpenLogs(task)}
            actionLabel={t('tasks.gitWorkspace.summary.open')}
          />

          <div className="hc-task-workspace-card__actions" onClick={stopCardClick}>
            <Space size={8} wrap>
              <Button icon={<FileTextOutlined />} onClick={() => onOpenLogs(task)}>
                {t('taskGroup.workspace.openLogs')}
              </Button>

              {canManage && isQueued && !editing ? (
                <Button icon={<EditOutlined />} onClick={startEditing}>
                  {t('taskGroup.workspace.edit')}
                </Button>
              ) : null}

              {canManage && isQueued && editing ? (
                <>
                  <Button type="primary" icon={<SaveOutlined />} onClick={(event) => void saveEdit(event)} loading={busy === `save:${task.id}`}>
                    {t('taskGroup.workspace.save')}
                  </Button>
                  <Button onClick={cancelEditing}>{t('common.cancel')}</Button>
                </>
              ) : null}

              {canManage && isQueued && !editing ? (
                <Button icon={<ArrowUpOutlined />} onClick={() => onReorder(task, 'move_earlier')} loading={busy === `move_earlier:${task.id}`}>
                  {t('taskGroup.workspace.moveEarlier')}
                </Button>
              ) : null}

              {canManage && isQueued && !editing ? (
                <Button icon={<ArrowDownOutlined />} onClick={() => onReorder(task, 'move_later')} loading={busy === `move_later:${task.id}`}>
                  {t('taskGroup.workspace.moveLater')}
                </Button>
              ) : null}

              {canManage && isQueued && !editing ? (
                <Button icon={<InsertRowAboveOutlined />} onClick={() => onReorder(task, 'insert_next')} loading={busy === `insert_next:${task.id}`}>
                  {t('taskGroup.workspace.prioritize')}
                </Button>
              ) : null}

              {canManage && (task.status === 'failed' || task.status === 'succeeded' || task.status === 'commented') ? (
                <Button icon={<ReloadOutlined />} onClick={() => onRetry(task)} loading={busy === `retry:${task.id}`}>
                  {t('tasks.retry')}
                </Button>
              ) : null}

              {canManage && isProcessing ? (
                <Button danger icon={<StopOutlined />} onClick={() => onStop(task)} loading={busy === `stop:${task.id}`}>
                  {t('tasks.stop')}
                </Button>
              ) : null}

              {canManage && isQueued ? (
                <Popconfirm title={t('taskGroup.workspace.cancelConfirm')} onConfirm={() => onDelete(task)}>
                  <Button danger icon={<DeleteOutlined />} loading={busy === `delete:${task.id}`}>
                    {t('taskGroup.workspace.cancel')}
                  </Button>
                </Popconfirm>
              ) : null}
            </Space>
          </div>
        </Space>
      </Card>
    </div>
  );
};

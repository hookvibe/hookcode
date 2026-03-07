import { FC, useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { ClockCircleOutlined, DownOutlined, FileTextOutlined, UpOutlined } from '@ant-design/icons';
import type { Task } from '../../api';
import { useLocale, useT } from '../../i18n';
import { TaskLogViewer } from '../TaskLogViewer';
import {
  clampText,
  eventTag,
  extractTaskResultSuggestions,
  extractTaskTokenUsage,
  extractTaskUserText,
  getTaskEventMarker,
  getTaskRepoName,
  getTaskTitle,
  isTerminalStatus,
  queuedHintText,
  statusTag
} from '../../utils/task';
import { LogViewerSkeleton } from '../skeletons/LogViewerSkeleton';
import { TaskGitStatusPanel } from '../tasks/TaskGitStatusPanel';
import { formatDateTime } from '../../utils/dateUtc';
import { formatRobotLabelWithProvider } from '../../utils/robot';

/**
 * TaskConversationItem:
 * - Business context: render a single task execution as a "chat-like" 4-part structure.
 *   1) User question (right bubble)
 *   2) Task card (left)
 *   3) Dialog-style execution log (left, always visible) -> real-time logs (SSE)
 *   4) Final result text (left)
 *   Note: Replace ThoughtChain with custom dialog log layout. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
 *
 * Change record:
 * - 2026-01-11: Added for `frontend-chat` Home/TaskGroup views to replace legacy UI pages with a chat-first experience.
 */

interface Props {
  task: Task;
  taskDetail?: Task | null;
  onOpenTask?: (task: Task) => void;
  taskLogsEnabled?: boolean | null;
  onSuggestionClick?: (suggestion: string, task: Task) => void;
  // Forward per-task log paging state to the parent TaskGroup chain loader. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
  onLogHistoryExhaustedChange?: (taskId: string, exhausted: boolean) => void;
  onLogLoadingEarlierChange?: (taskId: string, loading: boolean) => void;
  logLoadEarlierSignal?: number;
  // Mark the newest chat item so it can animate in-place during task-group creation. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  entering?: boolean;
}

export const TaskConversationItem: FC<Props> = ({
  task,
  taskDetail,
  onOpenTask,
  taskLogsEnabled,
  onSuggestionClick,
  onLogHistoryExhaustedChange,
  onLogLoadingEarlierChange,
  logLoadEarlierSignal,
  entering
}) => {
  const locale = useLocale();
  const t = useT();
  // Add collapsible log state to prevent long logs from blocking task navigation. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306
  const [logsExpanded, setLogsExpanded] = useState(false);

  const mergedTask = taskDetail ?? task;
  const effectiveTaskLogsEnabled = taskLogsEnabled === undefined ? true : taskLogsEnabled; // Keep chat UI consistent with backend log feature gating to avoid confusing errors. 0nazpc53wnvljv5yh7c6
  const userText = useMemo(() => extractTaskUserText(task) || t('chat.message.userTextFallback'), [t, task]);
  const title = useMemo(() => getTaskTitle(mergedTask), [mergedTask]);
  // Derive next-action suggestions from structured task output for chat follow-ups. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131
  const nextActions = useMemo(() => extractTaskResultSuggestions(mergedTask), [mergedTask]);
  const showResult = isTerminalStatus(task.status);
  // Compose enriched task-card metadata from merged task payloads for better timeline scanability. docs/en/developer/plans/task-group-card-modernize-20260306/task_plan.md task-group-card-modernize-20260306
  const eventMarker = useMemo(() => getTaskEventMarker(mergedTask), [mergedTask]);
  const repoName = useMemo(() => getTaskRepoName(mergedTask), [mergedTask]);
  const robotName = useMemo(() => {
    const raw = String(mergedTask.robot?.name ?? mergedTask.robotId ?? '').trim();
    if (!raw) return '';
    return formatRobotLabelWithProvider(raw, mergedTask.robot?.modelProvider ?? null);
  }, [mergedTask.robot?.modelProvider, mergedTask.robot?.name, mergedTask.robotId]);
  const tokenUsage = useMemo(() => extractTaskTokenUsage(mergedTask), [mergedTask]);
  const queueHint = useMemo(() => queuedHintText(t, mergedTask), [mergedTask, t]);
  const createdAt = useMemo(() => formatDateTime(locale, mergedTask.createdAt), [locale, mergedTask.createdAt]);
  const updatedAt = useMemo(() => formatDateTime(locale, mergedTask.updatedAt), [locale, mergedTask.updatedAt]);
  const formattedTokenUsage = useMemo(() => {
    if (!tokenUsage) return '';
    const numberFormatter = new Intl.NumberFormat(locale);
    return t('tasks.tokens.format', {
      input: numberFormatter.format(tokenUsage.inputTokens),
      output: numberFormatter.format(tokenUsage.outputTokens),
      total: numberFormatter.format(tokenUsage.totalTokens)
    });
  }, [locale, t, tokenUsage]);
  // Provide stage hints when logs have not started yet. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  const emptyLogMessage = useMemo(() => {
    if (mergedTask.status === 'queued') return t('logViewer.empty.queued.title');
    if (mergedTask.status === 'processing') return t('logViewer.empty.processing.title');
    return undefined;
  }, [mergedTask.status, t]);
  const emptyLogHint = useMemo(() => {
    if (mergedTask.status === 'queued') return t('logViewer.empty.queued.hint');
    if (mergedTask.status === 'processing') return t('logViewer.empty.processing.hint');
    return undefined;
  }, [mergedTask.status, t]);
  // Attach an entry animation class when a new task should transition into view. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  const rootClassName = `hc-chat-item${entering ? ' hc-chat-item--enter' : ''}`;

  return (
    <div className={rootClassName}>
      {/* 1) User question (right) */}
      <div className="hc-chat-item__user">
        <div className="hc-chat-bubble hc-chat-bubble--user">{userText}</div>
      </div>

      {/* 2) Task card (left) */}
      <div className="hc-chat-item__assistant">
        <Card
          size="small"
          hoverable
          className="hc-chat-task-card"
          // Refresh task cards with a denser but readable metadata layout for timeline triage. docs/en/developer/plans/task-group-card-modernize-20260306/task_plan.md task-group-card-modernize-20260306
          styles={{ body: { padding: 14 } }}
          onClick={() => onOpenTask?.(task)}
        >
          <div className="hc-chat-task-card__stack">
            <div className="hc-chat-task-card__header">
              <div className="hc-chat-task-card__title-wrap">
                <Typography.Text strong className="hc-chat-task-card__title">
                  {clampText(title, 120)}
                </Typography.Text>
                <Space size={6} wrap className="hc-chat-task-card__chips">
                  {statusTag(t, mergedTask.status)}
                  {eventTag(t, mergedTask.eventType)}
                </Space>
              </div>
              <Button
                type="text"
                size="small"
                icon={<FileTextOutlined />}
                className="hc-chat-task-card__open-btn"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onOpenTask?.(task);
                }}
              >
                {t('chat.message.openTask')}
              </Button>
            </div>

            <div className="hc-chat-task-card__identity">
              <Typography.Text type="secondary" className="hc-chat-task-card__identity-label">
                {t('tasks.field.id')}
              </Typography.Text>
              <Typography.Text code className="hc-chat-task-card__identity-value">
                {mergedTask.id}
              </Typography.Text>
              <Typography.Text type="secondary" className="hc-chat-task-card__identity-marker">
                {eventMarker || '-'}
              </Typography.Text>
            </div>

            <div className="hc-chat-task-card__meta-grid">
              <div className="hc-chat-task-card__meta-item">
                <Typography.Text type="secondary" className="hc-chat-task-card__meta-label">
                  {t('tasks.field.repo')}
                </Typography.Text>
                <Typography.Text className="hc-chat-task-card__meta-value" title={repoName || '-'}>
                  {repoName || '-'}
                </Typography.Text>
              </div>
              <div className="hc-chat-task-card__meta-item">
                <Typography.Text type="secondary" className="hc-chat-task-card__meta-label">
                  {t('tasks.field.robot')}
                </Typography.Text>
                <Typography.Text className="hc-chat-task-card__meta-value" title={robotName || '-'}>
                  {robotName || '-'}
                </Typography.Text>
              </div>
              <div className="hc-chat-task-card__meta-item">
                <Typography.Text type="secondary" className="hc-chat-task-card__meta-label">
                  {t('tasks.field.createdAt')}
                </Typography.Text>
                <Typography.Text className="hc-chat-task-card__meta-value">{createdAt}</Typography.Text>
              </div>
              <div className="hc-chat-task-card__meta-item">
                <Typography.Text type="secondary" className="hc-chat-task-card__meta-label">
                  {t('tasks.field.updatedAt')}
                </Typography.Text>
                <Typography.Text className="hc-chat-task-card__meta-value">{updatedAt}</Typography.Text>
              </div>
            </div>

            {queueHint ? (
              <div className="hc-chat-task-card__queue-hint">
                <ClockCircleOutlined />
                <Typography.Text type="secondary">{queueHint}</Typography.Text>
              </div>
            ) : null}

            {formattedTokenUsage ? (
              <div className="hc-chat-task-card__token-usage">
                <Typography.Text type="secondary" className="hc-chat-task-card__meta-label">
                  {t('tasks.field.tokens')}
                </Typography.Text>
                <Typography.Text className="hc-chat-task-card__token-value">{formattedTokenUsage}</Typography.Text>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      {/* 3) Dialog-style execution logs (non-bubble work area). docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128 */}
      <div className="hc-chat-item__assistant hc-chat-item__assistant_margin">
        {/* Add collapse/expand button for logs to prevent blocking task navigation. docs/en/developer/plans/taskgroup-logs-refactor-20260306/task_plan.md taskgroup-logs-refactor-20260306 */}
        {effectiveTaskLogsEnabled !== false && effectiveTaskLogsEnabled !== null && (
          <Button
            size="small"
            type="default"
            icon={logsExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="hc-chat-logs-toggle"
          >
            {logsExpanded ? t('chat.logs.collapse') : t('chat.logs.expand')}
          </Button>
        )}

        {logsExpanded && (
          <div className="hc-chat-logs-container">
            {/* Always render the dialog-style logs inline to keep TaskGroup parity with Task Detail. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128 */}
            {/* Guard SSE logs viewer when backend task logs are disabled. 0nazpc53wnvljv5yh7c6 */}
            {effectiveTaskLogsEnabled === false ? (
              <Alert type="info" showIcon message={t('logViewer.disabled')} />
            ) : effectiveTaskLogsEnabled === null ? (
              <>
                {/* Show a log-shaped skeleton while the logs feature gate is still loading. ro3ln7zex8d0wyynfj0m */}
                <LogViewerSkeleton lines={8} ariaLabel={t('common.loading')} />
              </>
            ) : (
              <TaskLogViewer
                taskId={task.id}
                canManage={Boolean(task.permissions?.canManage)}
                tail={400}
                variant="flat"
                emptyMessage={emptyLogMessage}
                emptyHint={emptyLogHint}
                // Bubble task-level paging status/events to TaskGroupChatPage for chained loading. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
                onHistoryExhaustedChange={(exhausted) => onLogHistoryExhaustedChange?.(task.id, exhausted)}
                onLoadingEarlierChange={(loading) => onLogLoadingEarlierChange?.(task.id, loading)}
                loadEarlierSignal={logLoadEarlierSignal}
              />
            )}
          </div>
        )}
      </div>

      {/* 4) Final text output Remove it for now. */}
      {/* {showResult ? (
        <div className="hc-chat-item__assistant">
          {resultText ? (
            <MarkdownViewer markdown={resultText} className="markdown-result--expanded" />
          ) : (
            <Typography.Text type="secondary">{t('chat.message.resultEmpty')}</Typography.Text>
          )}
        </div>
      ) : null} */}

      {showResult && nextActions.length ? (
        <div className="hc-chat-item__assistant">
          {/* Render next-action suggestions and wire clicks to the chat composer. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 */}
          <div className="hc-chat-suggestions">
            {nextActions.map((suggestion, index) => (
              <Button
                key={`${suggestion}-${index}`}
                size="small"
                onClick={() => onSuggestionClick?.(suggestion, task)}
                className="hc-chat-suggestion"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {mergedTask?.result?.gitStatus?.enabled ? (
        <div className="hc-chat-item__assistant">
          {/* Place git status at the bottom of each chat item with full width. docs/en/developer/plans/ujmczqa7zhw9pjaitfdj/task_plan.md ujmczqa7zhw9pjaitfdj */}
          <TaskGitStatusPanel task={mergedTask} variant="compact" />
        </div>
      ) : null}
    </div>
  );
};

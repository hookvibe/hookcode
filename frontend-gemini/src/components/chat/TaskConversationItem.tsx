import { FC, useMemo } from 'react';
import { Alert, Button, Card, Space, Typography } from '@/ui';
import { FileTextOutlined } from '@/ui/icons';
import type { Task } from '../../api';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { TaskLogViewer } from '../TaskLogViewer';
import { clampText, extractTaskResultText, extractTaskUserText, getTaskTitle, isTerminalStatus, statusTag } from '../../utils/task';
import { LogViewerSkeleton } from '../skeletons/LogViewerSkeleton';
import { TaskGitStatusPanel } from '../tasks/TaskGitStatusPanel';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

/**
 * TaskConversationItem:
 * - Business context: render a single task execution as a "chat-like" 4-part structure.
 *   1) User question (right bubble)
 *   2) Task card (left)
 *   3) Thought chain (left, always visible) -> real-time logs (SSE)
 *   4) Final result text (left)
 *
 * Change record:
 * - 2026-01-11: Added for `frontend-chat` Home/TaskGroup views to replace legacy UI pages with a chat-first experience.
 */

interface Props {
  task: Task;
  taskDetail?: Task | null;
  onOpenTask?: (task: Task) => void;
  taskLogsEnabled?: boolean | null;
  // Mark the newest chat item so it can animate in-place during task-group creation. docs/en/developer/plans/taskgrouptransition20260123/task_plan.md taskgrouptransition20260123
  entering?: boolean;
}

export const TaskConversationItem: FC<Props> = ({ task, taskDetail, onOpenTask, taskLogsEnabled, entering }) => {
  const t = useT();

  const mergedTask = taskDetail ?? task;
  const effectiveTaskLogsEnabled = taskLogsEnabled === undefined ? true : taskLogsEnabled; // Keep chat UI consistent with backend log feature gating to avoid confusing errors. 0nazpc53wnvljv5yh7c6
  const userText = useMemo(() => extractTaskUserText(task) || t('chat.message.userTextFallback'), [t, task]);
  const title = useMemo(() => getTaskTitle(mergedTask), [mergedTask]);
  const resultText = useMemo(() => extractTaskResultText(mergedTask), [mergedTask]);
  const showResult = isTerminalStatus(task.status);
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
          styles={{ body: { padding: 12 } }}
          onClick={() => onOpenTask?.(task)}
        >
          <Space orientation="vertical" size={6} style={{ width: '100%' }}>
            <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
              <Typography.Text strong style={{ minWidth: 0 }}>
                {clampText(title, 80)}
              </Typography.Text>
              {statusTag(t, task.status)}
            </Space>
            <Button
              type="link"
              size="small"
              icon={<FileTextOutlined />}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onOpenTask?.(task);
              }}
            >
              {t('chat.message.openTask')}
            </Button>
          </Space>
        </Card>
      </div>

      {/* 3) Thought chain (logs) */}
      <div className="hc-chat-item__assistant">
        <Card size="small" className="hc-chat-logs-card" styles={{ body: { padding: 12 } }}>
          {/* Always render the task ThoughtChain inline (Task Detail parity) and rely on TaskGroup reverse paging to avoid an overly long page. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121 */}
          {/* Guard SSE logs viewer when backend task logs are disabled. 0nazpc53wnvljv5yh7c6 */}
          {effectiveTaskLogsEnabled === false ? (
            <Alert type="info" showIcon message={t('logViewer.disabled')} />
          ) : effectiveTaskLogsEnabled === null ? (
            <>
              {/* Show a log-shaped skeleton while the logs feature gate is still loading. ro3ln7zex8d0wyynfj0m */}
              <LogViewerSkeleton lines={8} ariaLabel={t('common.loading')} />
            </>
          ) : (
            <TaskLogViewer taskId={task.id} canManage={Boolean(task.permissions?.canManage)} tail={400} variant="flat" />
          )}
        </Card>
      </div>

      {/* 4) Final text output */}
      {showResult ? (
        <div className="hc-chat-item__assistant">
          {resultText ? (
            <MarkdownViewer markdown={resultText} className="markdown-result--expanded" />
          ) : (
            <Typography.Text type="secondary">{t('chat.message.resultEmpty')}</Typography.Text>
          )}
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
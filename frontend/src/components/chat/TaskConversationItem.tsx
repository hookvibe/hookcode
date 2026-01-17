import { FC, useMemo, useState } from 'react';
import { Alert, Button, Card, Space, Typography } from 'antd';
import { DownOutlined, FileTextOutlined, UpOutlined } from '@ant-design/icons';
import type { Task } from '../../api';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { TaskLogViewer } from '../TaskLogViewer';
import { clampText, extractTaskResultText, extractTaskUserText, getTaskTitle, isTerminalStatus, statusTag } from '../../utils/task';

/**
 * TaskConversationItem:
 * - Business context: render a single task execution as a "chat-like" 4-part structure.
 *   1) User question (right bubble)
 *   2) Task card (left)
 *   3) Thought chain (left, collapsible) -> real-time logs (SSE)
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
}

export const TaskConversationItem: FC<Props> = ({ task, taskDetail, onOpenTask, taskLogsEnabled }) => {
  const t = useT();
  const [logsExpanded, setLogsExpanded] = useState(() => task.status === 'queued' || task.status === 'processing');

  const mergedTask = taskDetail ?? task;
  const effectiveTaskLogsEnabled = taskLogsEnabled === undefined ? true : taskLogsEnabled; // Keep chat UI consistent with backend log feature gating to avoid confusing errors. 0nazpc53wnvljv5yh7c6
  const userText = useMemo(() => extractTaskUserText(task) || t('chat.message.userTextFallback'), [t, task]);
  const title = useMemo(() => getTaskTitle(mergedTask), [mergedTask]);
  const resultText = useMemo(() => extractTaskResultText(mergedTask), [mergedTask]);
  const showResult = isTerminalStatus(task.status);

  return (
    <div className="hc-chat-item">
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
        <div className="hc-chat-logs-toggle">
          <Button
            type="text"
            size="small"
            icon={logsExpanded ? <UpOutlined /> : <DownOutlined />}
            onClick={() => setLogsExpanded((v) => !v)}
          >
            {logsExpanded ? t('chat.think.collapse') : t('chat.think.expand')}
          </Button>
        </div>
        {logsExpanded ? (
          <Card size="small" className="hc-chat-logs-card" styles={{ body: { padding: 0 } }}>
            {/* Guard SSE logs viewer when backend task logs are disabled. 0nazpc53wnvljv5yh7c6 */}
            {effectiveTaskLogsEnabled === false ? (
              <div style={{ padding: 12 }}>
                <Alert type="info" showIcon message={t('logViewer.disabled')} />
              </div>
            ) : effectiveTaskLogsEnabled === null ? (
              <div style={{ padding: 12 }}>
                <Typography.Text type="secondary">{t('common.loading')}</Typography.Text>
              </div>
            ) : (
              <TaskLogViewer taskId={task.id} canManage={Boolean(task.permissions?.canManage)} height={240} tail={400} />
            )}
          </Card>
        ) : null}
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
    </div>
  );
};

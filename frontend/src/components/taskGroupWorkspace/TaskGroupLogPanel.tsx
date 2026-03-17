import { useMemo } from 'react';
import { Alert, Skeleton, Space, Typography } from 'antd';
import type { Task } from '../../api';
import { useT } from '../../i18n';
import { TaskLogViewer } from '../TaskLogViewer';
import { MarkdownViewer } from '../MarkdownViewer';
import { TaskGitStatusPanel } from '../tasks/TaskGitStatusPanel';

interface TaskGroupLogPanelProps {
  task: Task;
  taskDetail?: Task | null;
}

export const TaskGroupLogPanel = ({ task, taskDetail }: TaskGroupLogPanelProps) => {
  const t = useT();
  const detail = taskDetail ?? null;
  const summary = useMemo(() => String(detail?.result?.summary ?? task.result?.summary ?? detail?.result?.message ?? task.result?.message ?? '').trim(), [detail?.result?.message, detail?.result?.summary, task.result?.message, task.result?.summary]);
  const outputText = useMemo(() => String(detail?.result?.outputText ?? '').trim(), [detail?.result?.outputText]);

  return (
    <div className="hc-task-workspace-log-panel">
      {/* Use the current Ant Design Space orientation API so the log panel stays warning-free in the workspace. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {!detail ? <Skeleton active paragraph={{ rows: 2 }} title={false} /> : null}

        {summary ? <Alert type="info" showIcon message={summary} /> : null}

        <TaskLogViewer
          taskId={task.id}
          canManage={Boolean(task.permissions?.canManage)}
          controls={{ reconnect: true }}
          emptyMessage={task.status === 'queued' ? t('logViewer.empty.queued.title') : task.status === 'processing' ? t('logViewer.empty.processing.title') : undefined}
          emptyHint={task.status === 'queued' ? t('logViewer.empty.queued.hint') : task.status === 'processing' ? t('logViewer.empty.processing.hint') : undefined}
          // Prefer task-detail snapshots when present so the workspace log panel rehydrates worker file diffs after refreshes. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
          workspaceChanges={detail?.result?.workspaceChanges ?? task.result?.workspaceChanges ?? null}
          variant="panel"
        />

        {outputText ? (
          <div className="hc-task-workspace-log-panel__output">
            <Typography.Text type="secondary">{t('taskGroup.workspace.output')}</Typography.Text>
            {/* Render task output as Markdown so structured lists/code blocks stay readable in the workspace log tab. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
            <MarkdownViewer markdown={outputText} className="markdown-result--expanded hc-task-workspace-log-panel__output-markdown" />
          </div>
        ) : null}

        {detail?.result?.gitStatus?.enabled ? <TaskGitStatusPanel task={detail} variant="compact" /> : null}
      </Space>
    </div>
  );
};

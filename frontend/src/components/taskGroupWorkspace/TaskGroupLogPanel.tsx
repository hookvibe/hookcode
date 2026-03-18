import { useMemo } from 'react';
import { Skeleton, Space } from 'antd';
import type { Task } from '../../api';
import { useT } from '../../i18n';
import { TaskLogViewer } from '../TaskLogViewer';
import { TaskGitWorkspacePanel } from '../tasks/TaskGitWorkspacePanel';

interface TaskGroupLogPanelProps {
  task: Task;
  taskDetail?: Task | null;
  onTaskUpdated?: (task: Task) => void | Promise<void>;
}

export const TaskGroupLogPanel = ({ task, taskDetail, onTaskUpdated }: TaskGroupLogPanelProps) => {
  const t = useT();
  const detail = taskDetail ?? null;
  const resolvedTask = detail ?? task;
  const showWorkspace = Boolean(
    resolvedTask.id &&
      (resolvedTask.status === 'processing' ||
        resolvedTask.repoId ||
        resolvedTask.result?.gitStatus?.enabled ||
        resolvedTask.result?.workspaceChanges?.files?.length)
  );

  return (
    <div className="hc-task-workspace-log-panel">
      {/* Use the current Ant Design Space orientation API so the log panel stays warning-free in the workspace. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {!detail ? <Skeleton active paragraph={{ rows: 2 }} title={false} /> : null}

        {/* Remove redundant summary Alert and outputText MarkdownViewer; timeline already shows all execution results inline. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318 */}

        <TaskLogViewer
          taskId={task.id}
          canManage={Boolean(task.permissions?.canManage)}
          controls={{ reconnect: true }}
          emptyMessage={task.status === 'queued' ? t('logViewer.empty.queued.title') : task.status === 'processing' ? t('logViewer.empty.processing.title') : undefined}
          emptyHint={task.status === 'queued' ? t('logViewer.empty.queued.hint') : task.status === 'processing' ? t('logViewer.empty.processing.hint') : undefined}
          task={resolvedTask}
          onTaskUpdated={onTaskUpdated}
          // Prefer task-detail snapshots when present so the workspace log panel rehydrates worker file diffs after refreshes. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
          workspaceChanges={detail?.result?.workspaceChanges ?? task.result?.workspaceChanges ?? null}
          variant="panel"
        />

        {showWorkspace ? (
          <div className="hc-task-workspace-log-panel__workspace">
            <TaskGitWorkspacePanel
              task={resolvedTask}
              onTaskUpdated={async () => {
                await onTaskUpdated?.(resolvedTask);
              }}
            />
          </div>
        ) : null}
      </Space>
    </div>
  );
};

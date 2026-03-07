import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { deleteTask, reorderQueuedTask, retryTask, stopTask, updateQueuedTaskContent, type Task } from '../../api';
import type { TFunction } from '../../i18n';

type TaskActionMessageApi = {
  success: (content: string) => void;
  error: (content: string) => void;
  warning: (content: string) => void;
};

type RefreshGroupDetail = (targetGroupId: string, options?: { mode?: 'blocking' | 'refreshing' }) => Promise<void>;

type UseTaskGroupTaskActionsParams = {
  taskGroupId?: string;
  message: TaskActionMessageApi;
  t: TFunction;
  refreshGroupDetail: RefreshGroupDetail;
  setTaskDetailsById: Dispatch<SetStateAction<Record<string, Task | null>>>;
  setOpenTaskLogIds: Dispatch<SetStateAction<string[]>>;
};

export const useTaskGroupTaskActions = ({
  taskGroupId,
  message,
  t,
  refreshGroupDetail,
  setTaskDetailsById,
  setOpenTaskLogIds
}: UseTaskGroupTaskActionsParams) => {
  const [taskActionLoadingKey, setTaskActionLoadingKey] = useState<string | null>(null);

  const refreshAfterMutation = useCallback(async () => {
    if (!taskGroupId) return;
    await refreshGroupDetail(taskGroupId, { mode: 'refreshing' });
  }, [refreshGroupDetail, taskGroupId]);

  // Centralize queue-card task mutations so the workspace keeps one stop/retry/reorder control flow. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const handleStopTask = useCallback(async (task: Task) => {
    if (!task.permissions?.canManage) {
      message.warning(t('tasks.empty.noPermission'));
      return;
    }
    setTaskActionLoadingKey(`stop:${task.id}`);
    try {
      const updated = await stopTask(task.id);
      setTaskDetailsById((prev) => ({ ...prev, [task.id]: updated }));
      message.success(t('toast.task.stopSuccess'));
      await refreshAfterMutation();
    } catch (error) {
      console.error(error);
      message.error(t('toast.task.stopFailed'));
    } finally {
      setTaskActionLoadingKey((prev) => (prev === `stop:${task.id}` ? null : prev));
    }
  }, [message, refreshAfterMutation, setTaskDetailsById, t]);

  const handleRetryTask = useCallback(async (task: Task) => {
    setTaskActionLoadingKey(`retry:${task.id}`);
    try {
      const updated = await retryTask(task.id);
      setTaskDetailsById((prev) => ({ ...prev, [task.id]: updated }));
      message.success(t('toast.task.retrySuccess'));
      await refreshAfterMutation();
    } catch (error) {
      console.error(error);
      message.error(t('toast.task.retryFailedTasksFailed'));
    } finally {
      setTaskActionLoadingKey((prev) => (prev === `retry:${task.id}` ? null : prev));
    }
  }, [message, refreshAfterMutation, setTaskDetailsById, t]);

  const handleDeleteQueuedTask = useCallback(async (task: Task) => {
    setTaskActionLoadingKey(`delete:${task.id}`);
    try {
      await deleteTask(task.id);
      setOpenTaskLogIds((prev) => prev.filter((taskId) => taskId !== task.id));
      setTaskDetailsById((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
      message.success(t('toast.task.deleted'));
      await refreshAfterMutation();
    } catch (error) {
      console.error(error);
      message.error(t('toast.task.deleteFailed'));
    } finally {
      setTaskActionLoadingKey((prev) => (prev === `delete:${task.id}` ? null : prev));
    }
  }, [message, refreshAfterMutation, setOpenTaskLogIds, setTaskDetailsById, t]);

  const handleSaveQueuedTask = useCallback(async (task: Task, text: string) => {
    setTaskActionLoadingKey(`save:${task.id}`);
    try {
      const updated = await updateQueuedTaskContent(task.id, text);
      setTaskDetailsById((prev) => ({ ...prev, [task.id]: updated }));
      message.success(t('taskGroup.workspace.saved'));
      await refreshAfterMutation();
    } catch (error) {
      console.error(error);
      message.error(t('taskGroup.workspace.saveFailed'));
    } finally {
      setTaskActionLoadingKey((prev) => (prev === `save:${task.id}` ? null : prev));
    }
  }, [message, refreshAfterMutation, setTaskDetailsById, t]);

  const handleReorderQueuedTask = useCallback(async (task: Task, action: 'move_earlier' | 'move_later' | 'insert_next') => {
    setTaskActionLoadingKey(`${action}:${task.id}`);
    try {
      const updated = await reorderQueuedTask(task.id, action);
      setTaskDetailsById((prev) => ({ ...prev, [task.id]: updated }));
      message.success(t('taskGroup.workspace.reordered'));
      await refreshAfterMutation();
    } catch (error) {
      console.error(error);
      message.error(t('taskGroup.workspace.reorderFailed'));
    } finally {
      setTaskActionLoadingKey((prev) => (prev === `${action}:${task.id}` ? null : prev));
    }
  }, [message, refreshAfterMutation, setTaskDetailsById, t]);

  return {
    taskActionLoadingKey,
    handleStopTask,
    handleRetryTask,
    handleDeleteQueuedTask,
    handleSaveQueuedTask,
    handleReorderQueuedTask
  };
};

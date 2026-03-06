import type { TaskGroup, TaskGroupKind } from '../api';
import type { useT } from '../i18n';

export const getTaskGroupTitle = (group: Pick<TaskGroup, 'title' | 'bindingKey' | 'id'>): string => {
  // Normalize task group titles for list cards and repo dashboards. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  const title = String(group.title ?? '').trim();
  return title || group.bindingKey || group.id;
};

export const getTaskGroupKindLabel = (t: ReturnType<typeof useT>, kind: TaskGroupKind): string => {
  // Centralize task-group kind labels so list pages and dashboards stay consistent. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  switch (kind) {
    case 'chat':
      return t('task.event.chat');
    case 'issue':
      return t('task.event.issue');
    case 'merge_request':
      return t('task.event.merge_request');
    case 'commit':
      return t('task.event.commit');
    case 'task':
      return t('taskGroups.kind.task');
    default:
      return t('taskGroups.kind.unknown');
  }
};

export const getTaskGroupKindColor = (kind: TaskGroupKind): string | undefined => {
  // Apply consistent tag colors per task group kind for faster scanning. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  switch (kind) {
    case 'chat':
      return 'geekblue';
    case 'issue':
      return 'gold';
    case 'merge_request':
      return 'purple';
    case 'commit':
      return 'cyan';
    case 'task':
      return 'green';
    default:
      return undefined;
  }
};


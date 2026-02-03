// Extract sidebar label helpers for task list navigation. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { Task } from '../api';
import type { TFunction } from '../i18n';
import { getTaskEventMarker, getTaskEventText, getTaskRepoName } from './labels';

export const getTaskSidebarPrimaryText = (t: TFunction, task: Task): string => {
  // Prefer event + identifier as the sidebar primary line to surface more context in limited space. mks8pr4r3m1fo9oqx9av
  const marker = getTaskEventMarker(task);
  const eventText = getTaskEventText(t, task.eventType); // Reuse centralized event labels across task UIs. aw85xyfsp5zfg6ihq3jr

  return marker ? `${eventText} ${marker}` : eventText;
};

export const getTaskSidebarSecondaryText = (task: Task): string => getTaskRepoName(task);

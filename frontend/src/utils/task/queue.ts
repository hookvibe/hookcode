// Extract queued task hint helpers for time-window messaging. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { Task } from '../api';
import type { TFunction } from '../i18n';
import { formatTimeWindowLabel } from '../timeWindow';

export const queuedHintText = (t: TFunction, task?: Task | null): string | null => {
  // Derive a short, i18n-friendly hint for queued tasks from backend queue diagnosis. f3a9c2d8e1b7f4a0c6d1
  if (!task || task.status !== 'queued') return null;
  const q = task.queue;
  if (!q) return t('tasks.queue.hint.unknown');

  const ahead = typeof q.ahead === 'number' && Number.isFinite(q.ahead) ? q.ahead : 0;
  const processing = typeof q.processing === 'number' && Number.isFinite(q.processing) ? q.processing : 0;

  if (q.reasonCode === 'outside_time_window') {
    const windowLabel = formatTimeWindowLabel(q.timeWindow);
    const sourceLabel = q.timeWindow ? t(`tasks.queue.timeWindow.source.${q.timeWindow.source}` as any) : t('tasks.queue.hint.unknown');
    // Highlight time-window gating so users understand queued tasks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    return t('tasks.queue.hint.timeWindow', { window: windowLabel || '--:--', source: sourceLabel });
  }
  if (q.reasonCode === 'queue_backlog') return t('tasks.queue.hint.backlog', { ahead, processing });
  if (q.reasonCode === 'inline_worker_disabled') return t('tasks.queue.hint.inlineWorkerDisabled');
  if (q.reasonCode === 'no_active_worker') return t('tasks.queue.hint.noActiveWorker');
  return t('tasks.queue.hint.unknown');
};

// Extract task status UI helpers for reuse across task views. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Tag } from 'antd';
import type { Task, TaskStatus } from '../api';
import type { TFunction } from '../i18n';
import { getTaskEventText } from './labels';

export const isTerminalStatus = (status: TaskStatus): boolean =>
  status === 'succeeded' || status === 'failed' || status === 'commented';

// Use muted tag colors that harmonize with the neutral B&W design system. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
export const statusTag = (t: TFunction, status: TaskStatus | string | null | undefined) => {
  const map: Record<string, { color: string; text: string }> = {
    queued: { color: 'default', text: t('task.status.queued') },
    waiting_approval: { color: 'warning', text: t('task.status.waiting_approval') },
    processing: { color: 'processing', text: t('task.status.processing') },
    paused: { color: 'default', text: t('task.status.paused') },
    succeeded: { color: 'success', text: t('task.status.succeeded') },
    failed: { color: 'error', text: t('task.status.failed') },
    commented: { color: 'default', text: t('task.status.commented') }
  };
  // Guard task-card status badges against unexpected runtime statuses so the queue workspace never crashes on partial payloads. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306
  const normalizedStatus = typeof status === 'string' && status.trim() ? status.trim() : 'unknown';
  const item = map[normalizedStatus] ?? {
    color: 'default',
    text: (() => {
      const translated = t(`task.status.${normalizedStatus}` as never);
      if (translated && translated !== `task.status.${normalizedStatus}`) return translated;
      return normalizedStatus.replace(/_/gu, ' ');
    })()
  };
  return <Tag color={item.color}>{item.text}</Tag>;
};

// Use a unified neutral color for all event tags to reduce visual noise in the monochrome UI. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
export const eventTag = (t: TFunction, eventType: Task['eventType']) => {
  return <Tag color="default">{getTaskEventText(t, eventType)}</Tag>;
};

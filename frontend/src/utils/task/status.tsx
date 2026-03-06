// Extract task status UI helpers for reuse across task views. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Tag } from 'antd';
import type { Task, TaskStatus } from '../api';
import type { TFunction } from '../i18n';
import { getTaskEventText } from './labels';

export const isTerminalStatus = (status: TaskStatus): boolean =>
  status === 'succeeded' || status === 'failed' || status === 'commented';

export const statusTag = (t: TFunction, status: TaskStatus | string | null | undefined) => {
  const map: Record<string, { color: string; text: string }> = {
    queued: { color: 'blue', text: t('task.status.queued') },
    processing: { color: 'gold', text: t('task.status.processing') },
    paused: { color: 'default', text: t('task.status.paused') },
    succeeded: { color: 'green', text: t('task.status.succeeded') },
    failed: { color: 'red', text: t('task.status.failed') },
    commented: { color: 'purple', text: t('task.status.commented') }
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

export const eventTag = (t: TFunction, eventType: Task['eventType']) => {
  const map: Record<string, { color: string }> = {
    commit_review: { color: 'cyan' },
    commit: { color: 'cyan' },
    push: { color: 'cyan' },
    merge_request: { color: 'geekblue' },
    issue_created: { color: 'volcano' },
    issue: { color: 'volcano' },
    issue_comment: { color: 'purple' },
    note: { color: 'purple' },
    unknown: { color: 'default' },
    chat: { color: 'blue' }
  };
  const item = map[eventType] ?? { color: 'default' };
  return <Tag color={item.color}>{getTaskEventText(t, eventType)}</Tag>;
};

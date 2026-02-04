// Extract task status UI helpers for reuse across task views. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Tag } from 'antd';
import type { Task, TaskStatus } from '../api';
import type { TFunction } from '../i18n';
import { getTaskEventText } from './labels';

export const isTerminalStatus = (status: TaskStatus): boolean =>
  status === 'succeeded' || status === 'failed' || status === 'commented';

export const statusTag = (t: TFunction, status: TaskStatus) => {
  const map: Record<TaskStatus, { color: string; text: string }> = {
    queued: { color: 'blue', text: t('task.status.queued') },
    processing: { color: 'gold', text: t('task.status.processing') },
    // Add paused status tags for stop/resume workflows. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
    paused: { color: 'orange', text: t('task.status.paused') },
    succeeded: { color: 'green', text: t('task.status.succeeded') },
    failed: { color: 'red', text: t('task.status.failed') },
    commented: { color: 'purple', text: t('task.status.commented') }
  };
  const item = map[status];
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

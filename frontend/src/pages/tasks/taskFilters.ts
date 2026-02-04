// Consolidate Tasks page filter helpers for reuse and smaller page components. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { TaskStatus } from '../../api';

export type StatusFilter = 'all' | TaskStatus | 'success';
export type StatusSummaryKey = 'all' | 'queued' | 'processing' | 'paused' | 'success' | 'failed';

export const normalizeStatusFilter = (value: string | undefined): StatusFilter => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === 'all') return 'all';
  if (raw === 'success') return 'success';
  // Accept paused status filters for stop/resume workflows. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203
  if (raw === 'queued' || raw === 'processing' || raw === 'paused' || raw === 'succeeded' || raw === 'failed' || raw === 'commented') {
    return raw;
  }
  // Compatibility: allow Home sidebar status keys.
  if (raw === 'completed') return 'success';
  return 'all';
};

export const getStatusSummaryKey = (statusFilter: StatusFilter): StatusSummaryKey => {
  // Group terminal success-like statuses under `success` for summary/UI selection. 3iz4jx8bsy7q7d6b3jr3
  if (statusFilter === 'queued') return 'queued';
  if (statusFilter === 'processing') return 'processing';
  if (statusFilter === 'paused') return 'paused';
  if (statusFilter === 'failed') return 'failed';
  if (statusFilter === 'all') return 'all';
  return 'success';
};

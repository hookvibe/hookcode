// Centralize AppShell sidebar constants to keep components focused. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { ReactNode } from 'react';
import { CheckCircleFilled, CloseCircleFilled, HourglassOutlined, LoadingOutlined } from '@ant-design/icons';
import type { Task } from '../../api';

export type SidebarTaskSectionKey = 'queued' | 'processing' | 'success' | 'failed';

export type SidebarTaskSection = {
  key: SidebarTaskSectionKey;
  statusFilter: 'queued' | 'processing' | 'success' | 'failed';
  labelKey: 'sidebar.tasks.queued' | 'sidebar.tasks.processing' | 'sidebar.tasks.completed' | 'sidebar.tasks.failed';
  icon: ReactNode;
};

export const TASK_SECTIONS: SidebarTaskSection[] = [
  { key: 'queued', statusFilter: 'queued', labelKey: 'sidebar.tasks.queued', icon: <HourglassOutlined /> },
  { key: 'processing', statusFilter: 'processing', labelKey: 'sidebar.tasks.processing', icon: <LoadingOutlined /> },
  { key: 'success', statusFilter: 'success', labelKey: 'sidebar.tasks.completed', icon: <CheckCircleFilled /> },
  { key: 'failed', statusFilter: 'failed', labelKey: 'sidebar.tasks.failed', icon: <CloseCircleFilled /> }
];

export const defaultExpanded: Record<SidebarTaskSectionKey, boolean> = {
  // UX: default to collapsed so the sidebar stays compact before the first refresh finishes.
  queued: false,
  processing: false,
  success: false,
  failed: false
};

export const defaultTasksByStatus: Record<SidebarTaskSectionKey, Task[]> = {
  queued: [],
  processing: [],
  success: [],
  failed: []
};

export const SIDEBAR_POLL_ACTIVE_MS = 10_000;
export const SIDEBAR_POLL_IDLE_MS = 30_000; // Slow down when no tasks are queued/processing. 7bqwou6abx4ste96ikhv
export const SIDEBAR_POLL_ERROR_MS = 2_000; // Retry faster while backend is starting to avoid SSE/proxy spam. 58w1q3n5nr58flmempxe
export const SIDEBAR_SSE_RECONNECT_BASE_MS = 2_000;
export const SIDEBAR_SSE_RECONNECT_MAX_MS = 30_000; // Cap SSE reconnect backoff to reduce dev proxy spam when backend is down. 58w1q3n5nr58flmempxe

export const SIDER_COLLAPSED_STORAGE_KEY = 'hookcode-sider-collapsed';

export const getInitialSiderCollapsed = (): boolean => {
  // Persist sidebar collapsed preference in localStorage across refresh. l7pvyrepxb0mx2ipdh2y
  if (typeof window === 'undefined') return false;
  const stored = window.localStorage?.getItem(SIDER_COLLAPSED_STORAGE_KEY) ?? '';
  if (stored === '1' || stored === 'true') return true;
  if (stored === '0' || stored === 'false') return false;
  return false;
};

import type { TimeWindow } from '../api';

const pad2 = (value: number): string => String(value).padStart(2, '0');

export const formatHourLabel = (hour: number): string => `${pad2(hour)}:00`;

export const buildHourOptions = (): Array<{ value: number; label: string }> => {
  // Provide consistent hour dropdown options for scheduling UI. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  return Array.from({ length: 24 }, (_, idx) => ({ value: idx, label: formatHourLabel(idx) }));
};

export const formatTimeWindowLabel = (window?: TimeWindow | null): string => {
  // Format hour-level time windows for concise UI labels. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  if (!window) return '';
  return `${formatHourLabel(window.startHour)}-${formatHourLabel(window.endHour)}`;
};

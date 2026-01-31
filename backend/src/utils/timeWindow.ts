import type { TaskScheduleSnapshot, TimeWindow, TimeWindowSource } from '../types/timeWindow';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toHour = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const rounded = Math.floor(value);
    return rounded >= 0 && rounded <= 23 ? rounded : null;
  }
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    const rounded = Math.floor(Number(value));
    return rounded >= 0 && rounded <= 23 ? rounded : null;
  }
  return null;
};

export const normalizeTimeWindow = (value: unknown): TimeWindow | null => {
  // Normalize hour-level windows from JSON/config payloads for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  if (!isRecord(value)) return null;
  const start = toHour((value as any).startHour);
  const end = toHour((value as any).endHour);
  if (start === null || end === null) return null;
  return { startHour: start, endHour: end };
};

export const isTimeWindowActive = (window: TimeWindow, now: Date = new Date()): boolean => {
  // Business rule: evaluate hour-level windows against server-local time; start==end means "always allowed". docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  const hour = now.getHours();
  const start = window.startHour;
  const end = window.endHour;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
};

const normalizeSource = (value: unknown): TimeWindowSource | null => {
  if (value === 'chat' || value === 'trigger' || value === 'robot') return value;
  return null;
};

export const resolveTaskSchedule = (params: {
  chatWindow?: TimeWindow | null;
  triggerWindow?: TimeWindow | null;
  robotWindow?: TimeWindow | null;
  ruleId?: string;
}): TaskScheduleSnapshot | null => {
  // Apply precedence chat > trigger > robot when deciding the effective execution window. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  if (params.chatWindow) {
    return { source: 'chat', window: params.chatWindow, timezone: 'server' };
  }
  if (params.triggerWindow) {
    return { source: 'trigger', window: params.triggerWindow, timezone: 'server', ruleId: params.ruleId };
  }
  if (params.robotWindow) {
    return { source: 'robot', window: params.robotWindow, timezone: 'server' };
  }
  return null;
};

export const extractTaskSchedule = (payload: unknown): TaskScheduleSnapshot | null => {
  // Read normalized schedule metadata from task payloads for queue gating and UI hints. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  if (!isRecord(payload)) return null;
  const scheduleRaw = (payload as any).__schedule;
  if (!isRecord(scheduleRaw)) return null;
  const source = normalizeSource((scheduleRaw as any).source);
  if (!source) return null;
  const window = normalizeTimeWindow((scheduleRaw as any).window);
  if (!window) return null;
  return {
    source,
    window,
    timezone: 'server',
    ruleId: typeof (scheduleRaw as any).ruleId === 'string' ? String((scheduleRaw as any).ruleId) : undefined,
    override: (scheduleRaw as any).override === true,
    overrideAt: typeof (scheduleRaw as any).overrideAt === 'string' ? String((scheduleRaw as any).overrideAt) : undefined
  };
};

export const attachTaskSchedule = (payload: unknown, schedule: TaskScheduleSnapshot | null): unknown => {
  // Persist resolved scheduling metadata in the task payload without mutating callers. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  if (!schedule) return payload;
  if (!isRecord(payload)) return payload;
  return { ...payload, __schedule: schedule };
};

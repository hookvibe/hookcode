// Define hour-level time window scheduling primitives shared across tasks and automation. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export type TimeWindowSource = 'robot' | 'trigger' | 'chat';

// Represent an hour-level execution window (start/end are 0-23, same-day local server time). docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export interface TimeWindow {
  startHour: number;
  endHour: number;
}

// Persist resolved scheduling context on tasks for queue gating and UI hints. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
export interface TaskScheduleSnapshot {
  source: TimeWindowSource;
  window: TimeWindow;
  timezone: 'server';
  ruleId?: string;
  override?: boolean;
  overrideAt?: string;
}

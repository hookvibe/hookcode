// Share log timeline reducer logic across TaskLogViewer modules. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { applyExecutionLogLine, buildExecutionTimeline, createEmptyTimeline, type ExecutionTimelineState } from '../../utils/executionLog';

export type ViewerMode = 'timeline' | 'raw';

export type TimelineAction =
  | { type: 'reset'; lines: string[] }
  | { type: 'append'; line: string }
  | { type: 'clear' };

export const timelineReducer = (state: ExecutionTimelineState, action: TimelineAction): ExecutionTimelineState => {
  if (action.type === 'reset') return buildExecutionTimeline(action.lines);
  if (action.type === 'append') return applyExecutionLogLine(state, action.line);
  if (action.type === 'clear') return createEmptyTimeline();
  return state;
};

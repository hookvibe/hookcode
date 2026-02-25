// Centralize log viewer stream payload types for reuse. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export interface StreamInitPayload {
  logs: string[];
}

export interface StreamLogPayload {
  line: string;
}

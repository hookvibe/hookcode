// Centralize log viewer stream payload types for reuse. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export interface StreamInitPayload {
  logs: string[];
  startSeq: number;
  endSeq: number;
  nextBefore?: number;
}

// Include per-line sequence ids so pagination stays consistent. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306
export interface StreamLogPayload {
  line: string;
  seq: number;
}

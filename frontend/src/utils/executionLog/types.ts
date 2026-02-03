// Split execution log types into a dedicated module. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export type ExecutionItemStatus = 'in_progress' | 'completed' | 'failed' | (string & {});

export type ExecutionFileChangeKind = 'create' | 'update' | 'delete' | (string & {});

export type ExecutionFileChange = {
  path: string;
  kind?: ExecutionFileChangeKind;
};

export type ExecutionFileDiff = {
  path: string;
  kind?: ExecutionFileChangeKind;
  unifiedDiff: string;
  oldText?: string;
  newText?: string;
};

// Represent todo_list entries so the exec viewer can render task progress instead of "unknown". docs/en/developer/plans/todoeventlog20260123/task_plan.md todoeventlog20260123
export type ExecutionTodoItem = {
  text: string;
  completed: boolean;
};

export type ExecutionItem =
  | {
      kind: 'command_execution';
      id: string;
      status: ExecutionItemStatus;
      command: string;
      exitCode?: number | null;
      output?: string;
    }
  | {
      kind: 'file_change';
      id: string;
      status: ExecutionItemStatus;
      changes: ExecutionFileChange[];
      diffs: ExecutionFileDiff[];
    }
  | {
      kind: 'agent_message';
      id: string;
      status: ExecutionItemStatus;
      text: string;
    }
  | {
      kind: 'reasoning';
      id: string;
      status: ExecutionItemStatus;
      text: string;
    }
  | {
      kind: 'todo_list';
      id: string;
      status: ExecutionItemStatus;
      items: ExecutionTodoItem[];
    }
  | {
      kind: 'unknown';
      id: string;
      status: ExecutionItemStatus;
      itemType: string;
      raw: unknown;
    };

export type ExecutionTimelineState = {
  items: ExecutionItem[];
  itemsById: Record<string, number>;
  parsedCount: number;
};

export type ParsedLine =
  | { kind: 'item'; item: ExecutionItem }
  | { kind: 'file_diff'; itemId: string; diff: ExecutionFileDiff }
  | { kind: 'ignore' };

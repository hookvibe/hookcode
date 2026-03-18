import { FC, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ExecutionFileDiff,
  ExecutionItem,
  ExecutionSubagentChildItem,
  ExecutionTodoItem,
  ExecutionTodoPriority,
  ExecutionTodoStatus
} from '../../utils/executionLog';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { TextPreviewBlock } from '../TextPreviewBlock';
import { DiffView } from '../diff/DiffView';
import { calculateUnifiedDiff, calculateUnifiedDiffStats } from '../diff/calculateDiff';
import { buildTextPreview, COMMAND_OUTPUT_PREVIEW_LIMITS, INLINE_DIFF_PREVIEW_LIMITS, RAW_TEXT_PREVIEW_LIMITS } from '../../utils/textPreview';
import '../../styles/execution-dialog.css';

export interface ExecutionTimelineProps {
  items: ExecutionItem[];
  showReasoning?: boolean;
  wrapDiffLines?: boolean;
  showLineNumbers?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
}

// Icons
const IconCode = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>;
const IconFile = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
const IconBrain = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" /><path d="M8.5 8.5v.01" /><path d="M16 16v.01" /><path d="M12 12v.01" /></svg>;
const IconList = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>;
const IconDots = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>;
const IconBot = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4" /><path d="M8 4h8" /><rect x="4" y="8" width="16" height="12" rx="3" /><path d="M9 13h.01" /><path d="M15 13h.01" /><path d="M8 17h8" /></svg>;
const IconChevronDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>;
const IconChevronRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>;
const IconCheckCircle = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12.75 11.25 15 15 9.75" /><circle cx="12" cy="12" r="9" /></svg>;
const IconClock = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v6l3 2" /></svg>;
const IconCircle = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /></svg>;

const formatPath = (raw: string): string => {
  const value = String(raw ?? '').trim();
  if (!value) return value;
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.length <= 3 ? value : parts.slice(-3).join('/');
};

const diffKey = (diff: ExecutionFileDiff): string => `${diff.path}::${diff.kind ?? ''}`;

const clampText = (raw: string, maxLen: number): string => {
  const cleanedText = raw.replace(/^\*+|\*+$/g, '').trim();
  const text = String(cleanedText ?? '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
};

const firstLine = (raw: string): string => {
  const text = String(raw ?? '');
  const line = text.split(/\r?\n/).find((value) => value.trim().length > 0);
  return (line ?? '').trim();
};

const summarizePaths = (paths: string[], maxItems = 3, maxLen = 160): string => {
  const usable = paths.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  if (!usable.length) return '';
  const sample = usable
    .slice(0, maxItems)
    .map((entry) => formatPath(entry))
    .filter(Boolean)
    .join(', ');
  return sample ? clampText(sample, maxLen) : '';
};

type StatusTone = 'running' | 'failed' | 'completed' | 'neutral';

type StatusMeta = {
  tone: StatusTone;
  label: string;
};

type FileChangeTone = 'default' | 'create' | 'delete';
type ToolCategory = 'default' | 'edit' | 'search' | 'bash' | 'todo' | 'agent' | 'plan' | 'question';

type FileDecoration = {
  badge: string;
  tone: FileChangeTone;
  labelKey: string;
  additions: number;
  deletions: number;
};

type TodoDisplayMeta = {
  icon: ReactNode;
  statusLabelKey: string;
  priorityLabelKey: string;
  statusClassName: string;
  priorityClassName: string;
};

// Render context passed to each detail renderer including parent-controlled expand state. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
type DetailRendererContext = {
  t: ReturnType<typeof useT>;
  wrapDiffLines: boolean;
  showLineNumbers: boolean;
  expanded: boolean;
};

type RendererDefinition = {
  icon: ReactNode;
  roleLabel: (t: ReturnType<typeof useT>) => string;
  kindLabel: (item: ExecutionItem, t: ReturnType<typeof useT>) => string;
  summary: (item: ExecutionItem, t: ReturnType<typeof useT>) => string;
  hideSummary?: boolean;
  hasDetails?: boolean;
  renderDetails: (item: ExecutionItem, context: DetailRendererContext) => ReactNode;
};

const resolveFileTone = (kind?: string): { badge: string; tone: FileChangeTone; labelKey: string } => {
  const normalizedKind = String(kind ?? '').trim().toLowerCase();
  if (normalizedKind === 'create' || normalizedKind === 'add' || normalizedKind === 'new') {
    return { badge: 'A', tone: 'create', labelKey: 'tasks.workspaceChanges.badge.create' };
  }
  if (normalizedKind === 'delete' || normalizedKind === 'remove') {
    return { badge: 'D', tone: 'delete', labelKey: 'tasks.workspaceChanges.badge.delete' };
  }
  return { badge: 'M', tone: 'default', labelKey: 'tasks.workspaceChanges.badge.update' };
};

const resolveDiffStats = (diff?: Pick<ExecutionFileDiff, 'oldText' | 'newText' | 'unifiedDiff'>): { additions: number; deletions: number } => {
  // Reuse the existing diff texts to derive compact git-style summaries so the execution timeline can mirror the dedicated workspace panel without new API fields. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  if (!diff) return { additions: 0, deletions: 0 };
  if (String(diff.unifiedDiff ?? '').trim()) {
    const stats = calculateUnifiedDiffStats(diff.unifiedDiff ?? '');
    if (stats.additions > 0 || stats.deletions > 0 || (typeof diff.oldText !== 'string' && typeof diff.newText !== 'string')) {
      return stats;
    }
  }
  if (typeof diff.oldText === 'string' || typeof diff.newText === 'string') {
    const oldPreview = buildTextPreview(diff.oldText ?? '', INLINE_DIFF_PREVIEW_LIMITS);
    const newPreview = buildTextPreview(diff.newText ?? '', INLINE_DIFF_PREVIEW_LIMITS);
    return calculateUnifiedDiff(oldPreview.text, newPreview.text, 0).stats;
  }
  return { additions: 0, deletions: 0 };
};

const buildFileDecorations = (item: Extract<ExecutionItem, { kind: 'file_change' }>): Map<string, FileDecoration> => {
  const diffMap = new Map(item.diffs.map((entry) => [entry.path, entry] as const));
  const knownPaths = new Set<string>();
  const decorations = new Map<string, FileDecoration>();

  item.changes.forEach((change) => {
    knownPaths.add(change.path);
    const tone = resolveFileTone(change.kind);
    const stats = resolveDiffStats(diffMap.get(change.path));
    decorations.set(change.path, { ...tone, ...stats });
  });

  item.diffs.forEach((diff) => {
    if (knownPaths.has(diff.path)) return;
    const tone = resolveFileTone(diff.kind);
    const stats = resolveDiffStats(diff);
    decorations.set(diff.path, { ...tone, ...stats });
  });

  return decorations;
};

const parseToolInput = (value: unknown): Record<string, unknown> => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
};

const formatToolInputText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return '';
    try {
      return JSON.stringify(JSON.parse(trimmed), null, 2);
    } catch {
      return trimmed;
    }
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const getToolCategory = (toolName?: string): ToolCategory => {
  if (!toolName) return 'default';
  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit' || toolName === 'ApplyPatch') return 'edit';
  if (toolName === 'Grep' || toolName === 'Glob') return 'search';
  if (toolName === 'Bash') return 'bash';
  if (toolName === 'TodoWrite' || toolName === 'TodoRead') return 'todo';
  if (toolName === 'Task' || toolName === 'TaskCreate' || toolName === 'TaskUpdate' || toolName === 'TaskList' || toolName === 'TaskGet') return 'agent';
  if (toolName === 'exit_plan_mode' || toolName === 'ExitPlanMode') return 'plan';
  if (toolName === 'AskUserQuestion') return 'question';
  return 'default';
};

const summarizeToolInput = (toolName?: string, toolInput?: unknown): string => {
  const input = parseToolInput(toolInput);
  if (!toolName) return '';

  if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit' || toolName === 'ApplyPatch') {
    const filePath = typeof input.file_path === 'string' ? input.file_path : typeof input.path === 'string' ? input.path : '';
    return filePath ? formatPath(filePath) : '';
  }

  if (toolName === 'Grep' || toolName === 'Glob') {
    return typeof input.pattern === 'string' ? input.pattern : '';
  }

  if (toolName === 'Bash') {
    const command = typeof input.command === 'string' ? input.command : '';
    return clampText(command, 52);
  }

  if (toolName === 'Task' || toolName === 'TaskCreate' || toolName === 'TaskUpdate') {
    const description = typeof input.description === 'string' ? input.description : typeof input.subagent_type === 'string' ? input.subagent_type : '';
    return clampText(description, 48);
  }

  if (toolName === 'WebFetch' || toolName === 'WebSearch') {
    const target = typeof input.url === 'string' ? input.url : typeof input.query === 'string' ? input.query : '';
    return clampText(target, 52);
  }

  if (typeof input.file_path === 'string') return formatPath(input.file_path);
  if (typeof input.path === 'string') return formatPath(input.path);
  if (typeof input.command === 'string') return clampText(input.command, 52);
  return '';
};

const buildCommandSummary = (item: Extract<ExecutionItem, { kind: 'command_execution' }>, t: ReturnType<typeof useT>): string => {
  if (item.toolName) {
    const toolSummary = summarizeToolInput(item.toolName, item.toolInput);
    return toolSummary
      ? t('execViewer.item.toolDetail', { tool: item.toolName, summary: toolSummary })
      : t('execViewer.item.tool', { tool: item.toolName });
  }

  const commandRaw = item.command?.trim();
  const commandSummary = commandRaw ? clampText(commandRaw, 160) : '';
  return commandSummary ? t('execViewer.item.commandDetail', { command: commandSummary }) : t('execViewer.item.command');
};

const todoStatusMeta = (status: ExecutionTodoStatus): TodoDisplayMeta => {
  if (status === 'completed') {
    return {
      icon: <IconCheckCircle />,
      statusLabelKey: 'execViewer.todo.status.completed',
      priorityLabelKey: 'execViewer.todo.priority.low',
      statusClassName: 'chat-todo__badge--completed',
      priorityClassName: 'chat-todo__badge--low'
    };
  }
  if (status === 'in_progress') {
    return {
      icon: <IconClock />,
      statusLabelKey: 'execViewer.todo.status.inProgress',
      priorityLabelKey: 'execViewer.todo.priority.medium',
      statusClassName: 'chat-todo__badge--progress',
      priorityClassName: 'chat-todo__badge--medium'
    };
  }
  return {
    icon: <IconCircle />,
    statusLabelKey: 'execViewer.todo.status.pending',
    priorityLabelKey: 'execViewer.todo.priority.low',
    statusClassName: 'chat-todo__badge--pending',
    priorityClassName: 'chat-todo__badge--low'
  };
};

const todoPriorityLabelKey = (priority: ExecutionTodoPriority): string => {
  if (priority === 'high') return 'execViewer.todo.priority.high';
  if (priority === 'medium') return 'execViewer.todo.priority.medium';
  return 'execViewer.todo.priority.low';
};

const buildTodoSummary = (item: Extract<ExecutionItem, { kind: 'todo_list' }>, t: ReturnType<typeof useT>): string => {
  const total = item.items.length;
  const completed = item.items.filter((entry) => entry.status === 'completed').length;
  const inProgress = item.items.find((entry) => entry.status === 'in_progress');
  if (!total) return t('execViewer.item.todoList');
  return inProgress
    ? `${t('execViewer.todo.progress', { done: completed, total })} · ${t('execViewer.todo.current', { content: clampText(inProgress.content, 64) })}`
    : t('execViewer.todo.progress', { done: completed, total });
};

const buildSubagentSummary = (item: Extract<ExecutionItem, { kind: 'subagent_container' }>): string => {
  const title = item.title?.trim() || item.description?.trim();
  if (!title) return '';
  return clampText(title, 160);
};

const buildStatusMeta = (item: ExecutionItem, t: ReturnType<typeof useT>): StatusMeta => {
  const status = String(item.status ?? '').trim().toLowerCase();
  const isRunning =
    status === 'in_progress' || status === 'started' || status === 'updated' || status === 'running' || status === 'processing';
  const isFailed = status === 'failed' || status === 'error';
  const isAbort = status === 'abort' || status === 'aborted' || status === 'cancelled' || status === 'canceled';

  if (item.kind === 'command_execution' && typeof item.exitCode === 'number') {
    return {
      tone: item.exitCode === 0 ? 'completed' : 'failed',
      label: t('execViewer.exitCode', { code: item.exitCode })
    };
  }

  if (isAbort) return { tone: 'failed', label: t('execViewer.status.failed') };
  if (isRunning) return { tone: 'running', label: t('execViewer.status.running') };
  if (isFailed) return { tone: 'failed', label: t('execViewer.status.failed') };
  if (status === 'completed' || status === 'success' || status === 'done') return { tone: 'completed', label: t('execViewer.status.completed') };

  return { tone: 'neutral', label: status || t('execViewer.status.completed') };
};

// Show tool input and command output directly when parent item is expanded (no inner toggle). docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
const CommandExecutionDetails: FC<{
  item: Extract<ExecutionItem, { kind: 'command_execution' }>;
  expanded: boolean;
}> = ({ item, expanded }) => {
  const toolInputText = formatToolInputText(item.toolInput);

  if (!expanded || (!item.output && !toolInputText)) return null;

  return (
    <div className="chat-collapsible-group">
      {toolInputText ? (
        <TextPreviewBlock
          text={toolInputText}
          limits={RAW_TEXT_PREVIEW_LIMITS}
          className="chat-preview-block"
          codeClassName="chat-work__mono"
        />
      ) : null}
      {item.output ? (
        <TextPreviewBlock
          text={item.output}
          limits={COMMAND_OUTPUT_PREVIEW_LIMITS}
          className="chat-preview-block"
          codeClassName="chat-work__mono"
        />
      ) : null}
    </div>
  );
};

// Show file changes and diffs when parent item is expanded. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
const FileChangeDetails: FC<{
  item: Extract<ExecutionItem, { kind: 'file_change' }>;
  wrapDiffLines: boolean;
  showLineNumbers: boolean;
  expanded: boolean;
}> = ({ item, wrapDiffLines, showLineNumbers, expanded }) => {
  const t = useT();
  const diffs = item.diffs ?? [];
  const fileDecorations = buildFileDecorations(item);
  const filesToShow = item.changes.length > 0 ? item.changes : diffs.map((diff) => ({ path: diff.path, kind: '' }));
  const [activeDiffPath, setActiveDiffPath] = useState<string | null>(diffs[0]?.path ?? filesToShow[0]?.path ?? null);
  const hasContent = filesToShow.length > 0 || diffs.length > 0;

  useEffect(() => {
    if (!diffs.length) {
      setActiveDiffPath(null);
      return;
    }
    if (activeDiffPath && diffs.some((diff) => diff.path === activeDiffPath)) return;
    setActiveDiffPath(diffs[0]?.path ?? null);
  }, [activeDiffPath, diffs]);

  if (!hasContent) return <span className="text-secondary">{t('execViewer.files.empty')}</span>;

  const activeDiff = diffs.find((diff) => diff.path === activeDiffPath) ?? diffs[0] ?? null;
  const activateDiffPath = (path: string) => {
    if (diffs.some((diff) => diff.path === path)) {
      setActiveDiffPath(path);
    }
  };

  return (
    <div className="chat-collapsible-group">
      {filesToShow.length > 0 ? (
        <div className="chat-files">
          {filesToShow.map((change, index) => {
            const decoration = fileDecorations.get(change.path) ?? { ...resolveFileTone(change.kind), additions: 0, deletions: 0 };
            const isLinkedToDiff = diffs.some((diff) => diff.path === change.path);
            return (
              <button
                key={`${index}-${change.path}`}
                type="button"
                className={`chat-file${activeDiff?.path === change.path ? ' is-active' : ''}`}
                onClick={() => activateDiffPath(change.path)}
                disabled={!isLinkedToDiff}
                aria-pressed={activeDiff?.path === change.path}
              >
                <span className={`chat-file__badge chat-file__badge--${decoration.tone}`}>{decoration.badge}</span>
                <span className="chat-file__path" title={change.path}>
                  {formatPath(change.path)}
                </span>
                <span className="chat-file__meta">
                  {change.kind ? <span className="chat-pill">{t(decoration.labelKey)}</span> : null}
                  {decoration.additions > 0 ? <span className="chat-file__metric chat-file__metric--add">{`+${decoration.additions}`}</span> : null}
                  {decoration.deletions > 0 ? <span className="chat-file__metric chat-file__metric--remove">{`-${decoration.deletions}`}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {diffs.length > 0 && expanded ? (
        <div className="chat-collapsible">
            <div className="chat-diffs">
              {diffs.length > 1 ? (
                <div className="chat-diff-tabs" role="tablist" aria-label={t('execViewer.section.fileDiffs')}>
                  {diffs.map((diff) => (
                    <button
                      key={diffKey(diff)}
                      type="button"
                      role="tab"
                      aria-selected={activeDiff?.path === diff.path}
                      className={`chat-diff-tabs__tab${activeDiff?.path === diff.path ? ' is-active' : ''}`}
                      onClick={() => setActiveDiffPath(diff.path)}
                    >
                      {formatPath(diff.path)}
                    </button>
                  ))}
                </div>
              ) : null}

              {activeDiff ? (() => {
                const diffStats = resolveDiffStats(activeDiff);
                return (
                  <div key={diffKey(activeDiff)} className="chat-diff">
                    <div className="chat-diff__header">
                      <span className="chat-diff__file" title={activeDiff.path}>
                        {formatPath(activeDiff.path)}
                      </span>
                      <span className="chat-diff__meta">
                        {diffStats.additions > 0 ? <span className="chat-file__metric chat-file__metric--add">{`+${diffStats.additions}`}</span> : null}
                        {diffStats.deletions > 0 ? <span className="chat-file__metric chat-file__metric--remove">{`-${diffStats.deletions}`}</span> : null}
                      </span>
                    </div>
                    {activeDiff.oldText !== undefined && activeDiff.newText !== undefined ? (
                      <DiffView
                        oldText={activeDiff.oldText}
                        newText={activeDiff.newText}
                        unifiedDiff={activeDiff.unifiedDiff}
                        showLineNumbers={showLineNumbers}
                        showPlusMinusSymbols
                        wrapLines={wrapDiffLines}
                      />
                    ) : (
                      <TextPreviewBlock
                        text={activeDiff.unifiedDiff}
                        emptyText={t('execViewer.diff.pending')}
                        limits={RAW_TEXT_PREVIEW_LIMITS}
                        className={`chat-preview-block ${wrapDiffLines ? 'is-wrap' : 'is-nowrap'}`}
                        codeClassName="chat-work__mono"
                      />
                    )}
                  </div>
                );
              })() : null}
            </div>
        </div>
      ) : null}
    </div>
  );
};

const ReasoningDetails: FC<{
  item: Extract<ExecutionItem, { kind: 'reasoning' }>;
}> = ({ item }) => {
  return (
    <div className="chat-reasoning">
      {item.text ? <MarkdownViewer markdown={item.text} className="markdown-result--expanded" /> : <span className="text-secondary">-</span>}
    </div>
  );
};

const TodoListDetails: FC<{
  item: Extract<ExecutionItem, { kind: 'todo_list' }>;
}> = ({ item }) => {
  const t = useT();
  const [showCompleted, setShowCompleted] = useState(true);
  const total = item.items.length;
  const completed = item.items.filter((entry) => entry.status === 'completed');
  const remainingItems = showCompleted ? item.items : item.items.filter((entry) => entry.status !== 'completed');
  const doneCount = completed.length;
  const currentItem = item.items.find((entry) => entry.status === 'in_progress');

  if (!item.items.length) return <span className="text-secondary">{t('execViewer.todo.empty')}</span>;

  return (
    <div className="chat-todo">
      <div className="chat-todo__summarybar">
        <span className="chat-todo__summary-pill">{t('execViewer.todo.progress', { done: doneCount, total })}</span>
        {currentItem ? <span className="chat-todo__summary-pill chat-todo__summary-pill--active">{t('execViewer.todo.current', { content: clampText(currentItem.content, 64) })}</span> : null}
        {completed.length > 0 ? (
          <button type="button" className="chat-todo__toggle" onClick={() => setShowCompleted((current) => !current)}>
            {showCompleted ? t('execViewer.todo.toggle.hideCompleted') : t('execViewer.todo.toggle.showCompleted')}
          </button>
        ) : null}
      </div>

      <div className="chat-todo__list">
        {remainingItems.map((entry, index) => {
          const statusMeta = todoStatusMeta(entry.status);
          return (
            <div key={entry.id ?? `${entry.content}-${index}`} className={`chat-todo__item${entry.status === 'completed' ? ' is-complete' : ''}`}>
              <span className={`chat-todo__icon chat-todo__icon--${entry.status}`}>
                {statusMeta.icon}
              </span>
              <div className="chat-todo__copy">
                <span className="chat-todo__text">{entry.content}</span>
                <span className="chat-todo__meta">
                  <span className={`chat-todo__badge ${statusMeta.statusClassName}`}>{t(statusMeta.statusLabelKey)}</span>
                  <span className={`chat-todo__badge chat-todo__badge--priority ${entry.priority === 'high' ? 'chat-todo__badge--high' : entry.priority === 'medium' ? 'chat-todo__badge--medium' : 'chat-todo__badge--low'}`}>
                    {t(todoPriorityLabelKey(entry.priority))}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SubagentChildRow: FC<{
  child: ExecutionSubagentChildItem;
  index: number;
}> = ({ child, index }) => {
  return (
    <div className="chat-subagent__row">
      <span className="chat-subagent__index">{index + 1}.</span>
      <span className="chat-subagent__tool">{child.toolName}</span>
      {child.summary ? <span className="chat-subagent__summary">{child.summary}</span> : null}
      {child.isError ? <span className="chat-subagent__error">(error)</span> : null}
    </div>
  );
};

const SubagentDetails: FC<{
  item: Extract<ExecutionItem, { kind: 'subagent_container' }>;
}> = ({ item }) => {
  const t = useT();
  const currentTool = item.currentToolIndex >= 0 ? item.childItems[item.currentToolIndex] : null;

  return (
    <div className="chat-subagent">
      {item.prompt ? <div className="chat-subagent__prompt">{item.prompt}</div> : null}
      {currentTool && !item.isComplete ? (
        <div className="chat-subagent__current">
          <span className="chat-subagent__pulse" />
          <span>{currentTool.toolName}</span>
          {currentTool.summary ? <span className="chat-subagent__summary">{currentTool.summary}</span> : null}
        </div>
      ) : null}
      {item.childItems.length > 0 ? (
        <details className="chat-subagent__history">
          <summary>{t('execViewer.section.toolHistory')} ({item.childItems.length})</summary>
          <div className="chat-subagent__rows">
            {item.childItems.map((child, index) => (
              <SubagentChildRow key={child.id} child={child} index={index} />
            ))}
          </div>
        </details>
      ) : null}
      {item.resultText ? <div className="chat-subagent__result">{item.resultText}</div> : null}
    </div>
  );
};

// Show raw JSON for unknown items when parent expanded. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
const UnknownDetails: FC<{
  item: Extract<ExecutionItem, { kind: 'unknown' }>;
  expanded: boolean;
}> = ({ item, expanded }) => {
  if (!expanded) return null;

  return (
    <div className="chat-collapsible">
      <TextPreviewBlock
        text={JSON.stringify(item.raw ?? item, null, 2)}
        limits={RAW_TEXT_PREVIEW_LIMITS}
        className="chat-preview-block"
        codeClassName="chat-work__mono"
      />
    </div>
  );
};

const executionRenderers: Record<ExecutionItem['kind'], RendererDefinition> = {
  command_execution: {
    icon: <IconCode />,
    roleLabel: (t) => t('execViewer.role.tool'),
    kindLabel: (item, t) => (item.kind === 'command_execution' && item.toolName ? item.toolName : t('execViewer.item.command')),
    summary: (item, t) => buildCommandSummary(item as Extract<ExecutionItem, { kind: 'command_execution' }>, t),
    hasDetails: true,
    renderDetails: (item, ctx) => <CommandExecutionDetails item={item as Extract<ExecutionItem, { kind: 'command_execution' }>} expanded={ctx.expanded} />
  },
  file_change: {
    icon: <IconFile />,
    roleLabel: (t) => t('execViewer.role.files'),
    kindLabel: (_item, t) => t('execViewer.item.files'),
    summary: (item, t) => {
      const fileItem = item as Extract<ExecutionItem, { kind: 'file_change' }>;
      const filePaths = (fileItem.changes.length ? fileItem.changes.map((entry) => entry.path) : fileItem.diffs.map((entry) => entry.path)).filter(Boolean);
      const summary = summarizePaths(filePaths, 3, 160);
      return summary ? t('execViewer.item.filesDetail', { summary }) : t('execViewer.item.files');
    },
    hideSummary: true,
    hasDetails: true,
    renderDetails: (item, context) => (
      <FileChangeDetails
        item={item as Extract<ExecutionItem, { kind: 'file_change' }>}
        wrapDiffLines={context.wrapDiffLines}
        showLineNumbers={context.showLineNumbers}
        expanded={context.expanded}
      />
    )
  },
  agent_message: {
    icon: <IconMessage />,
    roleLabel: (t) => t('execViewer.role.agent'),
    kindLabel: (_item, t) => t('execViewer.item.message'),
    summary: (item, t) => {
      const line = firstLine((item as Extract<ExecutionItem, { kind: 'agent_message' }>).text);
      return line ? clampText(line, 180) : t('execViewer.item.message');
    },
    renderDetails: () => null
  },
  reasoning: {
    icon: <IconBrain />,
    roleLabel: (t) => t('execViewer.role.agent'),
    kindLabel: (_item, t) => t('execViewer.item.reasoning'),
    summary: (item, t) => {
      const line = firstLine((item as Extract<ExecutionItem, { kind: 'reasoning' }>).text);
      return line ? clampText(line, 180) : t('execViewer.item.reasoning');
    },
    hideSummary: true,
    renderDetails: (item) => <ReasoningDetails item={item as Extract<ExecutionItem, { kind: 'reasoning' }>} />
  },
  todo_list: {
    icon: <IconList />,
    roleLabel: (t) => t('execViewer.role.plan'),
    kindLabel: (_item, t) => t('execViewer.item.todoList'),
    summary: (item, t) => buildTodoSummary(item as Extract<ExecutionItem, { kind: 'todo_list' }>, t),
    hideSummary: true,
    renderDetails: (item) => <TodoListDetails item={item as Extract<ExecutionItem, { kind: 'todo_list' }>} />
  },
  subagent_container: {
    icon: <IconBot />,
    roleLabel: (t) => t('execViewer.role.agent'),
    kindLabel: (_item, t) => t('execViewer.item.subagent'),
    summary: (item, t) => buildSubagentSummary(item as Extract<ExecutionItem, { kind: 'subagent_container' }>) || t('execViewer.item.subagent'),
    hideSummary: true,
    renderDetails: (item) => <SubagentDetails item={item as Extract<ExecutionItem, { kind: 'subagent_container' }>} />
  },
  unknown: {
    icon: <IconDots />,
    roleLabel: (t) => t('execViewer.role.system'),
    kindLabel: (_item, t) => t('execViewer.item.unknown'),
    summary: (_item, t) => t('execViewer.item.unknown'),
    hasDetails: true,
    renderDetails: (item, ctx) => <UnknownDetails item={item as Extract<ExecutionItem, { kind: 'unknown' }>} expanded={ctx.expanded} />
  }
};

// Each timeline item: clickable header toggles detail area; parent controls default expand. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
const ExecutionTimelineItem: FC<{
  item: ExecutionItem;
  wrapDiffLines: boolean;
  showLineNumbers: boolean;
  defaultExpanded: boolean;
}> = ({ item, wrapDiffLines, showLineNumbers, defaultExpanded }) => {
  const t = useT();
  const renderer = executionRenderers[item.kind];
  const status = buildStatusMeta(item, t);
  const toolCategoryClass =
    item.kind === 'command_execution' ? ` tool-${getToolCategory((item as Extract<ExecutionItem, { kind: 'command_execution' }>).toolName)}` : '';
  const hasExpandable = Boolean(renderer.hasDetails);
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Sync with parent-driven defaultExpanded when new items arrive; file_change items stay expanded always. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
  useEffect(() => {
    if (item.kind === 'file_change') return;
    setExpanded(defaultExpanded);
  }, [defaultExpanded, item.kind]);

  const bubbleClass = `chat-bubble chat-bubble--${item.kind === 'agent_message' ? 'message' : 'action'} kind-${item.kind}${toolCategoryClass} is-${status.tone}${expanded ? ' is-expanded' : ''}`;
  const showStatusBadge = status.tone === 'failed';
  const summary = renderer.summary(item, t);

  const handleHeaderClick = () => {
    if (hasExpandable) setExpanded((v) => !v);
  };

  return (
    <div className={bubbleClass}>
      <div className="chat-bubble__content">
        <div
          className={`chat-bubble__header${hasExpandable ? ' is-clickable' : ''}`}
          onClick={handleHeaderClick}
          role={hasExpandable ? 'button' : undefined}
          tabIndex={hasExpandable ? 0 : undefined}
          onKeyDown={hasExpandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHeaderClick(); } } : undefined}
        >
          {hasExpandable ? (
            <span className="chat-bubble__chevron">{expanded ? <IconChevronDown /> : <IconChevronRight />}</span>
          ) : null}
          <span className="chat-bubble__kind">{renderer.kindLabel(item, t)}</span>
          {!renderer.hideSummary && summary ? <span className="chat-bubble__summary">{summary}</span> : null}
          {showStatusBadge ? <span className={`chat-bubble__status is-${status.tone}`}>{status.label}</span> : null}
        </div>

        <div className="chat-bubble__body">
          {item.kind === 'agent_message' ? (
            item.text ? <MarkdownViewer markdown={item.text} className="markdown-result--expanded" /> : <span className="text-secondary">-</span>
          ) : null}
        </div>

        {renderer.renderDetails(item, { t, wrapDiffLines, showLineNumbers, expanded })}
      </div>
    </div>
  );
};

// Number of most-recent items to auto-expand in the timeline. docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
const AUTO_EXPAND_TAIL = 2;

export const ExecutionTimeline: FC<ExecutionTimelineProps> = ({
  items,
  showReasoning = false,
  wrapDiffLines = true,
  showLineNumbers = true,
  emptyMessage,
  emptyHint
}) => {
  const t = useT();

  const visibleItems = useMemo(() => (showReasoning ? items : items.filter((item) => item.kind !== 'reasoning')), [items, showReasoning]);

  const showRunningIndicator = visibleItems.some((item) => {
    const status = String(item.status ?? '').trim().toLowerCase();
    return status === 'in_progress' || status === 'started' || status === 'updated' || status === 'running' || status === 'processing';
  });

  // Build a Set of item IDs that should be auto-expanded: last N items plus ALL file_change items (always open). docs/en/developer/plans/taskgroup-ui-cleanup-20260318/task_plan.md taskgroup-ui-cleanup-20260318
  const autoExpandIds = useMemo(() => {
    const tail = visibleItems.slice(-AUTO_EXPAND_TAIL);
    const ids = new Set(tail.map((item) => item.id));
    for (const item of visibleItems) {
      if (item.kind === 'file_change') ids.add(item.id);
    }
    return ids;
  }, [visibleItems]);

  if (!visibleItems.length) {
    const fallbackMessage = emptyMessage ?? t('execViewer.empty.timeline');
    return (
      <div className="chat-empty">
        <span className="text-secondary">{fallbackMessage}</span>
        {emptyHint ? <span className="text-secondary">{emptyHint}</span> : null}
      </div>
    );
  }

  return (
    <div className="chat-stream">
      {visibleItems.map((item) => (
        <ExecutionTimelineItem
          key={item.id}
          item={item}
          wrapDiffLines={wrapDiffLines}
          showLineNumbers={showLineNumbers}
          defaultExpanded={autoExpandIds.has(item.id)}
        />
      ))}

      {showRunningIndicator ? (
        <div className="chat-running">
          <span className="chat-running__dots">
            <span />
            <span />
            <span />
          </span>
          <span className="text-secondary">{t('execViewer.status.running')}</span>
        </div>
      ) : null}
    </div>
  );
};

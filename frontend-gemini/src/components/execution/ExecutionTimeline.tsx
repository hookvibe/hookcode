import { FC, type ReactNode, useMemo, useState } from 'react';
import { Space, Tag, Typography } from '@/ui';
import { CaretDownOutlined, CaretRightOutlined, CheckSquareOutlined, CodeOutlined, FileTextOutlined, MessageOutlined, MoreOutlined } from '@/ui/icons';
import { Think, ThoughtChain, type ThoughtChainItemType } from '@/ui/thoughts';
import type { ExecutionFileDiff, ExecutionItem } from '../../utils/executionLog';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { DiffView } from '../diff/DiffView';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

export interface ExecutionTimelineProps {
  items: ExecutionItem[];
  showReasoning?: boolean;
  wrapDiffLines?: boolean;
  showLineNumbers?: boolean;
}

// Render structured execution steps parsed from JSONL task logs (Codex + HookCode diff artifacts). yjlphd6rbkrq521ny796
const formatPath = (raw: string): string => {
  const value = String(raw ?? '').trim();
  if (!value) return value;
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts.length <= 3 ? value : parts.slice(-3).join('/');
};

const diffKey = (diff: ExecutionFileDiff): string => `${diff.path}::${diff.kind ?? ''}`;

const clampText = (raw: string, maxLen: number): string => {
  // **Finalizing project details** remove *
  const cleanedText = raw.replace(/^\*+|\*+$/g, '').trim();
  const text = String(cleanedText ?? '').trim();  
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
};

const firstLine = (raw: string): string => {
  const text = String(raw ?? '');
  const line = text.split(/\r?\n/).find((v) => v.trim().length > 0);
  return (line ?? '').trim();
};

// Summarize execution detail text for richer headers and inline labels. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
const summarizePaths = (paths: string[], maxItems = 3, maxLen = 160): string => {
  const usable = paths.map((entry) => String(entry ?? '').trim()).filter(Boolean);
  if (!usable.length) return '';
  const sample = usable.slice(0, maxItems).map((entry) => formatPath(entry)).filter(Boolean).join(', ');
  return sample ? clampText(sample, maxLen) : '';
};

type ExecutionThinkProps = {
  title: ReactNode;
  icon?: ReactNode;
  hideIcon?: boolean;
  loading?: boolean;
  blink?: boolean;
  defaultExpanded?: boolean;
  children?: ReactNode;
};

const ExecutionThink: FC<ExecutionThinkProps> = ({ title, icon, hideIcon = true, loading, blink, defaultExpanded = false, children }) => {
  // Control Think expansion so we can use CaretRight/CaretDown icons and default-collapse details. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Think
      className={hideIcon ? 'hc-exec-think hc-exec-think--no-icon' : 'hc-exec-think'}
      icon={icon}
      loading={loading}
      blink={blink}
      expanded={expanded}
      onExpand={setExpanded}
      title={
        <span className="hc-exec-think-title">
          <span className="hc-exec-think-title__caret">{expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}</span>
          <span className="hc-exec-think-title__text">{title}</span>
        </span>
      }
    >
      {children}
    </Think>
  );
};

export const ExecutionTimeline: FC<ExecutionTimelineProps> = ({ items, showReasoning = false, wrapDiffLines = true, showLineNumbers = true }) => {
  const t = useT();

  const visibleItems = useMemo(() => (showReasoning ? items : items.filter((item) => item.kind !== 'reasoning')), [items, showReasoning]);

  const toThoughtStatus = (item: ExecutionItem): ThoughtChainItemType['status'] | undefined => {
    // Map HookCode/Codex execution statuses to custom thought-chain status icons. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
    const status = String(item.status ?? '').trim().toLowerCase();
    const isRunning =
      status === 'in_progress' || status === 'started' || status === 'updated' || status === 'running' || status === 'processing';
    const isFailed = status === 'failed' || status === 'error';
    const isAbort = status === 'abort' || status === 'aborted' || status === 'cancelled' || status === 'canceled';

    if (isAbort) return 'abort';
    if (isRunning) return 'loading';

    if (item.kind === 'command_execution' && typeof item.exitCode === 'number') {
      return item.exitCode === 0 ? 'success' : 'error';
    }

    if (isFailed) return 'error';
    if (status === 'completed' || status === 'success' || status === 'done') return 'success';
    return undefined;
  };

  // Simplify item headers (no "Completed" tag / exit code text); rely on ThoughtChain status icons instead. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
  const buildTitle = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'command_execution') {
      // Use command detail text in the header to avoid generic "Command" labels. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
      const commandRaw = item.command?.trim();
      const commandSummary = commandRaw ? clampText(commandRaw, 160) : '';
      const commandLabel = commandSummary ? t('execViewer.item.commandDetail', { command: commandSummary }) : t('execViewer.item.command');
      return (
        <Space size={8} wrap style={{ minWidth: 0 }}>
          <CodeOutlined />
          {/* Allow command titles to wrap within the ThoughtChain header to avoid overflow. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t */}
          <Typography.Text strong className="hc-exec-title-text" title={commandRaw || undefined}>
            {commandLabel}
          </Typography.Text>
        </Space>
      );
    }

    if (item.kind === 'file_change') {
      // Summarize changed file paths in the header to make file steps descriptive. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
      const filePaths = (item.changes.length ? item.changes.map((entry) => entry.path) : (item.diffs ?? []).map((entry) => entry.path)).filter(
        (entry) => entry
      );
      const summary = summarizePaths(filePaths, 3, 160);
      const fullSummary = filePaths.join('\n');
      const fileLabel = summary ? t('execViewer.item.filesDetail', { summary }) : t('execViewer.item.files');
      const fileCount = item.changes.length || item.diffs?.length || 0;
      return (
        <Space size={8} wrap style={{ minWidth: 0 }}>
          <FileTextOutlined />
          {/* Allow file-change titles to wrap within the ThoughtChain header to avoid overflow. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t */}
          <Typography.Text strong className="hc-exec-title-text" title={fullSummary || summary || undefined}>
            {fileLabel}
          </Typography.Text>
          {fileCount ? <Typography.Text type="secondary">{t('execViewer.files.count', { count: fileCount })}</Typography.Text> : null}
        </Space>
      );
    }

    if (item.kind === 'agent_message') {
      const line = firstLine(item.text);
      const text = line ? clampText(line, 140) : t('execViewer.item.message');
      return (
        <Space size={8} wrap style={{ minWidth: 0 }}>
          <MessageOutlined />
          {/* Allow message headers to wrap in narrow chat cards instead of truncating. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t */}
          <Typography.Text strong className="hc-exec-title-text" title={line || undefined}>
            {text}
          </Typography.Text>
        </Space>
      );
    }

    if (item.kind === 'reasoning') {
      const line = firstLine(item.text);
      const text = line ? clampText(line, 140) : t('execViewer.item.reasoning');
      return (
        <Space size={8} wrap style={{ minWidth: 0 }}>
          <MoreOutlined />
          {/* Allow reasoning headers to wrap in narrow chat cards instead of truncating. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t */}
          <Typography.Text strong className="hc-exec-title-text" title={line || undefined}>
            {text}
          </Typography.Text>
        </Space>
      );
    }

    if (item.kind === 'todo_list') {
      // Surface todo_list progress in the timeline header for quick scanning. docs/en/developer/plans/todoeventlog20260123/task_plan.md todoeventlog20260123
      const total = item.items.length;
      const completed = item.items.filter((entry) => entry.completed).length;
      return (
        <Space size={8} wrap>
          <CheckSquareOutlined />
          <Typography.Text strong>{t('execViewer.item.todoList')}</Typography.Text>
          {total ? <Typography.Text type="secondary">{t('execViewer.todo.progress', { done: completed, total })}</Typography.Text> : null}
        </Space>
      );
    }

    return (
      <Space size={8} wrap>
        <MoreOutlined />
        <Typography.Text strong>{t('execViewer.item.unknown')}</Typography.Text>
      </Space>
    );
  };

  const buildDescription = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'command_execution') {
      // Avoid repeating the same command in multiple places (title + description + content). docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
      return null;
    }

    if (item.kind === 'file_change') {
      // Keep file summaries in the title so descriptions do not duplicate path lists. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
      return null;
    }

    if (item.kind === 'agent_message') {
      // Move message snippets into ThoughtChain titles to keep the node scan-friendly without duplicate lines. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
      return null;
    }

    if (item.kind === 'reasoning') {
      // Move reasoning snippets into ThoughtChain titles to keep the node scan-friendly without duplicate lines. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5
      return null;
    }

    if (item.kind === 'todo_list') {
      // The todo_list header already includes progress, so keep the description clean. docs/en/developer/plans/todoeventlog20260123/task_plan.md todoeventlog20260123
      return null;
    }

    return null;
  };

  const renderContent = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'command_execution') {
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink
          // Show a stable output label here since the command is already in the step header. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
          title={t('execViewer.section.commandOutput')}
          icon={<CodeOutlined />}
          hideIcon
          loading={running}
          blink={running}
          defaultExpanded={false}
        >
          {item.output ? <pre className="hc-exec-output">{item.output}</pre> : <Typography.Text type="secondary">-</Typography.Text>}
        </ExecutionThink>
      );
    }

    if (item.kind === 'file_change') {
      const running = toThoughtStatus(item) === 'loading';
      const diffs = item.diffs ?? [];
      return (
        <ExecutionThink
          // Keep a single collapsible block for file changes to avoid duplicate expanders. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
          title={t('execViewer.section.fileDetails')}
          icon={<FileTextOutlined />}
          loading={running}
          blink={running}
          defaultExpanded={false}
        >
          {item.changes.length ? (
            <div className="hc-exec-files">
              {item.changes.map((change, idx) => (
                <div key={`${idx}-${change.path}`} className="hc-exec-file">
                  <Typography.Text className="hc-exec-file__path" ellipsis={{ tooltip: change.path }}>
                    {formatPath(change.path)}
                  </Typography.Text>
                  {change.kind ? (
                    <Tag color="default" style={{ marginInlineStart: 8 }}>
                      {change.kind}
                    </Tag>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <Typography.Text type="secondary">{t('execViewer.files.empty')}</Typography.Text>
          )}

          {diffs.length ? (
            <div className="hc-exec-diff-list">
              {diffs.map((diff) => (
                <div key={diffKey(diff)} className="hc-exec-diff">
                  <Typography.Text className="hc-exec-diff__file" ellipsis={{ tooltip: diff.path }}>
                    {formatPath(diff.path)}
                  </Typography.Text>
                  {/* Render diffs inline so file changes use one collapse affordance. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t */}
                  {diff.oldText !== undefined && diff.newText !== undefined ? (
                    <DiffView oldText={diff.oldText} newText={diff.newText} showLineNumbers={showLineNumbers} showPlusMinusSymbols wrapLines={wrapDiffLines} />
                  ) : (
                    <pre className="hc-exec-output hc-exec-output--mono">{diff.unifiedDiff}</pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <Typography.Text type="secondary">{t('execViewer.diff.pending')}</Typography.Text>
          )}
        </ExecutionThink>
      );
    }

    if (item.kind === 'agent_message') {
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink title={t('execViewer.item.message')} hideIcon icon={<MessageOutlined />} loading={running} blink={running} defaultExpanded={false}>
          {item.text ? <MarkdownViewer markdown={item.text} className="markdown-result--expanded" /> : <Typography.Text type="secondary">-</Typography.Text>}
        </ExecutionThink>
      );
    }

    if (item.kind === 'reasoning') {
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink title={t('execViewer.item.reasoning')} icon={<MoreOutlined />} loading={running} blink={running} defaultExpanded={false}>
          <pre className="hc-exec-output hc-exec-output--mono">{item.text || '-'}</pre>
        </ExecutionThink>
      );
    }

    if (item.kind === 'todo_list') {
      // Render todo_list items with completion styling to avoid the "unknown event" fallback. docs/en/developer/plans/todoeventlog20260123/task_plan.md todoeventlog20260123
      const running = toThoughtStatus(item) === 'loading';
      return (
        <ExecutionThink title={t('execViewer.item.todoList')} icon={<CheckSquareOutlined />} loading={running} blink={running} defaultExpanded={false}>
          {item.items.length ? (
            <div className="hc-exec-todo">
              {item.items.map((entry, index) => (
                <div key={`${entry.text}-${index}`} className={`hc-exec-todo__item${entry.completed ? ' is-complete' : ''}`}>
                  <span className="hc-exec-todo__marker" />
                  <Typography.Text delete={entry.completed}>{entry.text}</Typography.Text>
                </div>
              ))}
            </div>
          ) : (
            <Typography.Text type="secondary">{t('execViewer.todo.empty')}</Typography.Text>
          )}
        </ExecutionThink>
      );
    }

    return (
      <ExecutionThink title={t('execViewer.item.unknown')} icon={<MoreOutlined />} defaultExpanded={false}>
        <pre className="hc-exec-output hc-exec-output--mono">{JSON.stringify((item as any).raw ?? item, null, 2)}</pre>
      </ExecutionThink>
    );
  };

  const chainItems = useMemo<ThoughtChainItemType[]>(
    () =>
      visibleItems.map((item) => ({
        key: item.id,
        title: buildTitle(item),
        description: buildDescription(item),
        content: renderContent(item),
        status: toThoughtStatus(item),
        blink: toThoughtStatus(item) === 'loading'
      })),
    [visibleItems, showLineNumbers, t, wrapDiffLines]
  );
  // Track running items so we can show a live indicator at the bottom. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t
  const showRunningIndicator = visibleItems.some((item) => toThoughtStatus(item) === 'loading');

  if (!chainItems.length) {
    // Avoid conditional hooks by rendering the empty state after all hooks have executed. docs/en/developer/plans/taskgroupthoughtchain20260121/task_plan.md taskgroupthoughtchain20260121
    return (
      <div className="hc-exec-empty">
        <Typography.Text type="secondary">{t('execViewer.empty.timeline')}</Typography.Text>
      </div>
    );
  }

  return (
    <div className="hc-exec-timeline">
      {/* Replace per-step Cards with custom ThoughtChain/Think to improve scanability of structured logs. docs/en/developer/plans/djr800k3pf1hl98me7z5/task_plan.md djr800k3pf1hl98me7z5 */}
      <ThoughtChain items={chainItems} rootClassName="hc-exec-thought-chain" line="solid" />
      {showRunningIndicator ? (
        <div className="hc-exec-running" role="status" aria-live="polite">
          {/* Show an animated in-progress marker at the bottom during execution. docs/en/developer/plans/c3ytvybx46880dhfqk7t/task_plan.md c3ytvybx46880dhfqk7t */}
          <span className="hc-exec-running__dots" aria-hidden="true">
            <span className="hc-exec-running__dot" />
            <span className="hc-exec-running__dot" />
            <span className="hc-exec-running__dot" />
          </span>
          <Typography.Text type="secondary">{t('execViewer.status.running')}</Typography.Text>
        </div>
      ) : null}
    </div>
  );
};

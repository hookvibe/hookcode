import { FC, type ReactNode, useMemo } from 'react';
import { Space, Typography } from 'antd';
import { CheckSquareOutlined, CodeOutlined, FileTextOutlined, MessageOutlined, MoreOutlined } from '@ant-design/icons';
import type { ExecutionFileDiff, ExecutionItem } from '../../utils/executionLog';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { DiffView } from '../diff/DiffView';

export interface ExecutionTimelineProps {
  items: ExecutionItem[];
  showReasoning?: boolean;
  wrapDiffLines?: boolean;
  showLineNumbers?: boolean;
}

// Render structured execution steps parsed from JSONL task logs as dialog-style rows. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
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

// Summarize execution detail text for richer headers and inline labels. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
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

export const ExecutionTimeline: FC<ExecutionTimelineProps> = ({ items, showReasoning = false, wrapDiffLines = true, showLineNumbers = true }) => {
  const t = useT();

  const visibleItems = useMemo(() => (showReasoning ? items : items.filter((item) => item.kind !== 'reasoning')), [items, showReasoning]);

  const buildStatusMeta = (item: ExecutionItem): StatusMeta => {
    // Normalize execution status text so dialog entries can share the same badge styling. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
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

  const buildRoleLabel = (item: ExecutionItem): string => {
    // Assign a dialog "speaker" label so logs read like a structured conversation. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
    if (item.kind === 'command_execution') return t('execViewer.role.tool');
    if (item.kind === 'file_change') return t('execViewer.role.files');
    if (item.kind === 'todo_list') return t('execViewer.role.plan');
    if (item.kind === 'reasoning') return t('execViewer.role.agent');
    if (item.kind === 'agent_message') return t('execViewer.role.agent');
    return t('execViewer.role.system');
  };

  const buildKindLabel = (item: ExecutionItem): string => {
    if (item.kind === 'command_execution') return t('execViewer.item.command');
    if (item.kind === 'file_change') return t('execViewer.item.files');
    if (item.kind === 'agent_message') return t('execViewer.item.message');
    if (item.kind === 'reasoning') return t('execViewer.item.reasoning');
    if (item.kind === 'todo_list') return t('execViewer.item.todoList');
    return t('execViewer.item.unknown');
  };

  const buildDialogSummary = (item: ExecutionItem): string => {
    if (item.kind === 'command_execution') {
      const commandRaw = item.command?.trim();
      const commandSummary = commandRaw ? clampText(commandRaw, 160) : '';
      return commandSummary ? t('execViewer.item.commandDetail', { command: commandSummary }) : t('execViewer.item.command');
    }

    if (item.kind === 'file_change') {
      const filePaths = (item.changes.length ? item.changes.map((entry) => entry.path) : (item.diffs ?? []).map((entry) => entry.path)).filter(
        (entry) => entry
      );
      const summary = summarizePaths(filePaths, 3, 160);
      return summary ? t('execViewer.item.filesDetail', { summary }) : t('execViewer.item.files');
    }

    if (item.kind === 'agent_message') {
      const line = firstLine(item.text);
      return line ? clampText(line, 180) : t('execViewer.item.message');
    }

    if (item.kind === 'reasoning') {
      const line = firstLine(item.text);
      return line ? clampText(line, 180) : t('execViewer.item.reasoning');
    }

    if (item.kind === 'todo_list') {
      const total = item.items.length;
      const completed = item.items.filter((entry) => entry.completed).length;
      return total ? t('execViewer.todo.progress', { done: completed, total }) : t('execViewer.item.todoList');
    }

    return t('execViewer.item.unknown');
  };

  const renderDialogLine = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'agent_message') {
      return item.text ? (
        <MarkdownViewer markdown={item.text} className="markdown-result--expanded" />
      ) : (
        <Typography.Text type="secondary">-</Typography.Text>
      );
    }

    const summary = buildDialogSummary(item);
    return summary ? <Typography.Text className="hc-exec-dialog__line-text">{summary}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text>;
  };

  // Group detailed work artifacts under a dedicated work-area panel per dialog entry. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
  const renderWorkArea = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'agent_message') return null;

    const workTitle = t('execViewer.section.workArea');

    if (item.kind === 'command_execution') {
      return (
        <div className="hc-exec-dialog__work">
          <div className="hc-exec-dialog__work-header">{workTitle}</div>
          <div className="hc-exec-dialog__work-section">
            <div className="hc-exec-dialog__work-title">{t('execViewer.section.commandOutput')}</div>
            {item.output ? <pre className="hc-exec-dialog__mono">{item.output}</pre> : <Typography.Text type="secondary">-</Typography.Text>}
          </div>
        </div>
      );
    }

    if (item.kind === 'file_change') {
      const diffs = item.diffs ?? [];
      return (
        <div className="hc-exec-dialog__work">
          <div className="hc-exec-dialog__work-header">{workTitle}</div>
          <div className="hc-exec-dialog__work-section">
            <div className="hc-exec-dialog__work-title">{t('execViewer.section.filesList')}</div>
            {item.changes.length ? (
              <div className="hc-exec-dialog__files">
                {item.changes.map((change, idx) => (
                  <div key={`${idx}-${change.path}`} className="hc-exec-dialog__file">
                    <Typography.Text className="hc-exec-dialog__file-path" ellipsis={{ tooltip: change.path }}>
                      {formatPath(change.path)}
                    </Typography.Text>
                    {change.kind ? <span className="hc-exec-dialog__pill">{change.kind}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">{t('execViewer.files.empty')}</Typography.Text>
            )}
          </div>
          <div className="hc-exec-dialog__work-section">
            <div className="hc-exec-dialog__work-title">{t('execViewer.section.fileDiffs')}</div>
            {diffs.length ? (
              <div className="hc-exec-dialog__diff-list">
                {diffs.map((diff) => (
                  <div key={diffKey(diff)} className="hc-exec-dialog__diff">
                    <Typography.Text className="hc-exec-dialog__diff-file" ellipsis={{ tooltip: diff.path }}>
                      {formatPath(diff.path)}
                    </Typography.Text>
                    {diff.oldText !== undefined && diff.newText !== undefined ? (
                      <DiffView
                        oldText={diff.oldText}
                        newText={diff.newText}
                        showLineNumbers={showLineNumbers}
                        showPlusMinusSymbols
                        wrapLines={wrapDiffLines}
                      />
                    ) : (
                      <pre className="hc-exec-dialog__mono">{diff.unifiedDiff}</pre>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">{t('execViewer.diff.pending')}</Typography.Text>
            )}
          </div>
        </div>
      );
    }

    if (item.kind === 'reasoning') {
      return (
        <div className="hc-exec-dialog__work">
          <div className="hc-exec-dialog__work-header">{workTitle}</div>
          <div className="hc-exec-dialog__work-section">
            <div className="hc-exec-dialog__work-title">{t('execViewer.section.reasoningDetail')}</div>
            {/* Render reasoning content as Markdown inside the work area for rich formatting. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128 */}
            {item.text ? (
              <MarkdownViewer markdown={item.text} className="markdown-result--expanded" />
            ) : (
              <Typography.Text type="secondary">-</Typography.Text>
            )}
          </div>
        </div>
      );
    }

    if (item.kind === 'todo_list') {
      return (
        <div className="hc-exec-dialog__work">
          <div className="hc-exec-dialog__work-header">{workTitle}</div>
          <div className="hc-exec-dialog__work-section">
            <div className="hc-exec-dialog__work-title">{t('execViewer.section.todoItems')}</div>
            {item.items.length ? (
              <div className="hc-exec-dialog__todo">
                {item.items.map((entry, index) => (
                  <div key={`${entry.text}-${index}`} className={`hc-exec-dialog__todo-item${entry.completed ? ' is-complete' : ''}`}>
                    <span className="hc-exec-dialog__todo-marker" />
                    <Typography.Text delete={entry.completed}>{entry.text}</Typography.Text>
                  </div>
                ))}
              </div>
            ) : (
              <Typography.Text type="secondary">{t('execViewer.todo.empty')}</Typography.Text>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="hc-exec-dialog__work">
        <div className="hc-exec-dialog__work-header">{workTitle}</div>
        <div className="hc-exec-dialog__work-section">
          <div className="hc-exec-dialog__work-title">{t('execViewer.item.unknown')}</div>
          <pre className="hc-exec-dialog__mono">{JSON.stringify((item as any).raw ?? item, null, 2)}</pre>
        </div>
      </div>
    );
  };

  const showRunningIndicator = visibleItems.some((item) => buildStatusMeta(item).tone === 'running');

  if (!visibleItems.length) {
    return (
      <div className="hc-exec-empty">
        <Typography.Text type="secondary">{t('execViewer.empty.timeline')}</Typography.Text>
      </div>
    );
  }

  // Render dialog-style execution entries with a separate work area instead of ThoughtChain. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128
  return (
    <div className="hc-exec-dialog">
      {visibleItems.map((item, index) => {
        const status = buildStatusMeta(item);
        const role = buildRoleLabel(item);
        const kind = buildKindLabel(item);
        const summary = buildDialogSummary(item);
        const itemClass = `hc-exec-dialog__item is-${status.tone}`;
        const statusClass = `hc-exec-dialog__status is-${status.tone}`;

        return (
          <div key={item.id} className={itemClass}>
            <div className="hc-exec-dialog__rail" aria-hidden="true">
              <span className="hc-exec-dialog__dot" />
              {index < visibleItems.length - 1 ? <span className="hc-exec-dialog__line" /> : null}
            </div>
            <div className="hc-exec-dialog__content">
              <div className="hc-exec-dialog__header">
                <span className="hc-exec-dialog__role">{role}</span>
                <Space size={6} wrap>
                  {item.kind === 'command_execution' ? <CodeOutlined /> : null}
                  {item.kind === 'file_change' ? <FileTextOutlined /> : null}
                  {item.kind === 'agent_message' ? <MessageOutlined /> : null}
                  {item.kind === 'reasoning' ? <MoreOutlined /> : null}
                  {item.kind === 'todo_list' ? <CheckSquareOutlined /> : null}
                  {item.kind === 'unknown' ? <MoreOutlined /> : null}
                  <Typography.Text className="hc-exec-dialog__kind">{kind}</Typography.Text>
                </Space>
                <span className={statusClass}>{status.label}</span>
              </div>
              <div className="hc-exec-dialog__speech">
                {item.kind === 'agent_message' ? renderDialogLine(item) : <Typography.Text className="hc-exec-dialog__line-text">{summary}</Typography.Text>}
              </div>
              {renderWorkArea(item)}
            </div>
          </div>
        );
      })}
      {showRunningIndicator ? (
        <div className="hc-exec-running" role="status" aria-live="polite">
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

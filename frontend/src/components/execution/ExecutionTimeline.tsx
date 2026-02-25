import { FC, type ReactNode, useMemo, useState } from 'react';
import type { ExecutionFileDiff, ExecutionItem } from '../../utils/executionLog';
import { useT } from '../../i18n';
import { MarkdownViewer } from '../MarkdownViewer';
import { DiffView } from '../diff/DiffView';

export interface ExecutionTimelineProps {
  items: ExecutionItem[];
  showReasoning?: boolean;
  wrapDiffLines?: boolean;
  showLineNumbers?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
}

// Icons
const IconCode = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>;
const IconFile = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>;
const IconMessage = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>;
const IconBrain = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"></path><path d="M8.5 8.5v.01"></path><path d="M16 16v.01"></path><path d="M12 12v.01"></path></svg>;
const IconList = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>;
const IconDots = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>;
const IconChevronDown = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;
const IconChevronRight = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>;

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
  const line = text.split(/\r?\n/).find((v) => v.trim().length > 0);
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

// --- Sub-component for individual items ---

const ExecutionTimelineItem: FC<{
  item: ExecutionItem;
  wrapDiffLines: boolean;
  showLineNumbers: boolean;
  t: any;
}> = ({ item, wrapDiffLines, showLineNumbers, t }) => {
  const [expanded, setExpanded] = useState(false);

  const buildStatusMeta = (item: ExecutionItem): StatusMeta => {
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
        <span className="text-secondary">-</span>
      );
    }

    const summary = buildDialogSummary(item);
    return summary ? <span className="chat-bubble__summary">{summary}</span> : <span className="text-secondary">-</span>;
  };

  const renderWorkArea = (item: ExecutionItem): ReactNode => {
    if (item.kind === 'agent_message') return null;

    // Command Execution: Output is collapsible
    if (item.kind === 'command_execution') {
      if (!item.output) return null;
      return (
        <div className="chat-collapsible">
          <button className="chat-collapsible__toggle" onClick={() => setExpanded(!expanded)}>
             {expanded ? <IconChevronDown /> : <IconChevronRight />}
             <span>{t('execViewer.section.commandOutput')}</span>
          </button>
          {expanded && <pre className="chat-work__mono">{item.output}</pre>}
        </div>
      );
    }

    // File Change: Diffs are collapsible
    if (item.kind === 'file_change') {
      const diffs = item.diffs ?? [];
      
      // Use explicit changes if available, otherwise derive from diffs to ensure file list is visible
      const filesToShow = item.changes.length > 0 
        ? item.changes 
        : diffs.map(d => ({ path: d.path, kind: '' })); 

      const hasContent = filesToShow.length > 0 || diffs.length > 0;
      
      if (!hasContent) return <span className="text-secondary">{t('execViewer.files.empty')}</span>;

      return (
        <div className="chat-collapsible-group">
           {filesToShow.length > 0 && (
              <div className="chat-files">
                {filesToShow.map((change, idx) => (
                  <div key={`${idx}-${change.path}`} className="chat-file">
                    <span className="chat-file__path" title={change.path}>
                      {formatPath(change.path)}
                    </span>
                    {change.kind ? <span className="chat-pill">{change.kind}</span> : null}
                  </div>
                ))}
              </div>
           )}

           {diffs.length > 0 && (
             <div className="chat-collapsible">
               <button className="chat-collapsible__toggle" onClick={() => setExpanded(!expanded)}>
                  {expanded ? <IconChevronDown /> : <IconChevronRight />}
                  <span>{t('execViewer.section.fileDiffs')}</span>
               </button>
               {expanded && (
                 <div className="chat-diffs">
                    {diffs.map((diff) => (
                      <div key={diffKey(diff)} className="chat-diff">
                        <span className="chat-diff__file" title={diff.path}>
                          {formatPath(diff.path)}
                        </span>
                        {diff.oldText !== undefined && diff.newText !== undefined ? (
                          <DiffView
                            oldText={diff.oldText}
                            newText={diff.newText}
                            showLineNumbers={showLineNumbers}
                            showPlusMinusSymbols
                            wrapLines={wrapDiffLines}
                          />
                        ) : (
                          <pre className="chat-work__mono">{diff.unifiedDiff}</pre>
                        )}
                      </div>
                    ))}
                 </div>
               )}
             </div>
           )}
        </div>
      );
    }

    // Reasoning: Always expanded (it's the content)
    if (item.kind === 'reasoning') {
      return (
        <div className="chat-reasoning">
          {item.text ? (
            <MarkdownViewer markdown={item.text} className="markdown-result--expanded" />
          ) : (
            <span className="text-secondary">-</span>
          )}
        </div>
      );
    }

    // Todo List: Always visible
    if (item.kind === 'todo_list') {
      if (!item.items.length) return <span className="text-secondary">{t('execViewer.todo.empty')}</span>;
      return (
        <div className="chat-todo">
          {item.items.map((entry, index) => (
            <div key={`${entry.text}-${index}`} className={`chat-todo__item${entry.completed ? ' is-complete' : ''}`}>
              <span className="chat-todo__marker" />
              {entry.completed ? <del>{entry.text}</del> : <span>{entry.text}</span>}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="chat-collapsible">
        <button className="chat-collapsible__toggle" onClick={() => setExpanded(!expanded)}>
           {expanded ? <IconChevronDown /> : <IconChevronRight />}
           <span>{t('execViewer.item.unknown')}</span>
        </button>
        {expanded && <pre className="chat-work__mono">{JSON.stringify((item as any).raw ?? item, null, 2)}</pre>}
      </div>
    );
  };

  const status = buildStatusMeta(item);
  const role = buildRoleLabel(item);
  const kind = buildKindLabel(item);
  const bubbleClass = `chat-bubble chat-bubble--${item.kind === 'agent_message' ? 'message' : 'action'} kind-${item.kind} is-${status.tone}`;

  // Determine if we should show the summary line in the body.
  // Reasoning and File Changes have their content fully in the WorkArea/Details, so we hide the summary to avoid duplication.
  const showSummary = item.kind !== 'reasoning' && item.kind !== 'file_change';

  return (
    <div className={bubbleClass}>
      <div className="chat-bubble__avatar">
        {item.kind === 'command_execution' && <IconCode />}
        {item.kind === 'file_change' && <IconFile />}
        {item.kind === 'agent_message' && <IconMessage />}
        {item.kind === 'reasoning' && <IconBrain />}
        {item.kind === 'todo_list' && <IconList />}
        {item.kind === 'unknown' && <IconDots />}
      </div>
      
      <div className="chat-bubble__content">
         <div className="chat-bubble__header">
            <span className="chat-bubble__role">{role}</span>
            <span className="chat-bubble__kind">{kind}</span>
            <span className={`chat-bubble__status is-${status.tone}`}>{status.label}</span>
         </div>
         
         {/* Main Content Line */}
         {/* Only render body if it's an agent message (full text) or if it's a type that needs a summary (command) */}
         <div className="chat-bubble__body">
            {item.kind === 'agent_message' 
              ? renderDialogLine(item) 
              : (showSummary ? <span className="chat-bubble__summary">{buildDialogSummary(item)}</span> : null)
            }
         </div>

         {/* Collapsible / Details Area */}
         {renderWorkArea(item)}
      </div>
    </div>
  );
};

// --- Main Component ---

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
          t={t}
        />
      ))}
      
      {showRunningIndicator && (
        <div className="chat-running">
          <span className="chat-running__dots">
            <span />
            <span />
            <span />
          </span>
          <span className="text-secondary">{t('execViewer.status.running')}</span>
        </div>
      )}
    </div>
  );
};

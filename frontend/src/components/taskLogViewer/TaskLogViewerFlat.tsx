import type { ReactNode, RefObject } from 'react';
import type { ExecutionTimelineState } from '../../utils/executionLog';
import { ExecutionTimeline } from '../execution/ExecutionTimeline';
import type { TFunction } from '../../i18n';

export type TaskLogViewerFlatProps = {
  t: TFunction;
  error: string | null;
  timeline: ExecutionTimelineState;
  logs: string[];
  lines: string;
  showReasoning: boolean;
  emptyMessage: string;
  emptyHint?: string;
  rootRef: RefObject<HTMLDivElement>;
  endRef: RefObject<HTMLDivElement>;
  messageContextHolder: ReactNode;
};

export const TaskLogViewerFlat = ({
  t,
  error,
  timeline,
  logs,
  lines,
  showReasoning,
  emptyMessage,
  emptyHint,
  rootRef,
  endRef,
  messageContextHolder
}: TaskLogViewerFlatProps) => (
  <div ref={rootRef}>
    {messageContextHolder}
    {error ? (
        <div className="log-error" style={{ marginBottom: 8 }}>
           <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
           <span>{error}</span>
        </div>
    ) : null}
    {timeline.items.length ? (
      <>
        <ExecutionTimeline
          items={timeline.items}
          showReasoning={showReasoning}
          wrapDiffLines={true}
          showLineNumbers={true}
          emptyMessage={emptyMessage}
          emptyHint={emptyHint}
        />
      </>
    ) : logs.length ? (
      <pre className="hc-task-code-block hc-task-code-block--expanded">{lines}</pre>
    ) : (
      <div className="chat-empty">
        <span className="text-secondary">{emptyMessage}</span>
        {emptyHint ? <span className="text-secondary">{emptyHint}</span> : null}
      </div>
    )}
    <div ref={endRef} />
  </div>
);

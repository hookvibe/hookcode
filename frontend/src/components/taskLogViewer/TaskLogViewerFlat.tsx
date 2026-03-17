import type { ReactNode, RefObject } from 'react';
import type { TaskWorkspaceChanges } from '../../api';
import type { ExecutionTimelineState } from '../../utils/executionLog';
import { ExecutionTimeline } from '../execution/ExecutionTimeline';
import type { TFunction } from '../../i18n';
import { TextPreviewBlock } from '../TextPreviewBlock';
import { TaskWorkspaceChangesPanel } from '../tasks/TaskWorkspaceChangesPanel';
import { RAW_TEXT_PREVIEW_LIMITS } from '../../utils/textPreview';

export type TaskLogViewerFlatProps = {
  t: TFunction;
  error: string | null;
  timeline: ExecutionTimelineState;
  logs: string[];
  lines: string;
  showReasoning: boolean;
  showLoadEarlier: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  emptyMessage: string;
  emptyHint?: string;
  // Mirror the panel-mode workspace snapshot prop so flat log views can render the same worker diff chrome. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316
  workspaceChanges?: TaskWorkspaceChanges | null;
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
  showLoadEarlier,
  loadingEarlier,
  onLoadEarlier,
  emptyMessage,
  emptyHint,
  workspaceChanges,
  rootRef,
  endRef,
  messageContextHolder
}: TaskLogViewerFlatProps) => {
  const sectionTitle = timeline.items.length ? t('execViewer.actions.showTimeline') : logs.length ? t('execViewer.actions.showRaw') : t('logViewer.title');

  return (
    <div ref={rootRef} className="log-viewer log-viewer--flat">
      {messageContextHolder}
      <div className="log-viewer__body">
        <div className="log-viewer__stack">
          {/* Offer paged log access in the flat log view. docs/en/developer/plans/task-logs-table-20260306/task_plan.md task-logs-table-20260306 */}
          {showLoadEarlier ? (
            <div className="log-flat-actions">
              <button type="button" className="log-btn log-btn--labelled" onClick={onLoadEarlier} disabled={loadingEarlier} title={t('logViewer.actions.loadEarlier')}>
                {t('logViewer.actions.loadEarlier')}
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="log-error">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span>{error}</span>
            </div>
          ) : null}
          {/* Keep the flat log variant feature-complete with the panel view by rendering the same workspace diff card stack. docs/en/developer/plans/worker-file-diff-ui-20260316/task_plan.md worker-file-diff-ui-20260316 */}
          <TaskWorkspaceChangesPanel changes={workspaceChanges} />
          <section className="log-viewer__section">
            <div className="log-viewer__section-bar">
              <span className="log-viewer__section-title">{sectionTitle}</span>
              {logs.length ? <span className="log-viewer__section-meta">{t('logViewer.lines', { count: logs.length })}</span> : null}
            </div>
            <div className="log-viewer__section-body">
              {timeline.items.length ? (
                <ExecutionTimeline
                  items={timeline.items}
                  showReasoning={showReasoning}
                  wrapDiffLines={true}
                  showLineNumbers={true}
                  emptyMessage={emptyMessage}
                  emptyHint={emptyHint}
                />
              ) : logs.length ? (
                <TextPreviewBlock
                  text={lines}
                  limits={RAW_TEXT_PREVIEW_LIMITS}
                  className="log-viewer__raw-preview is-nowrap"
                  codeClassName="hc-task-code-block hc-task-code-block--expanded"
                />
              ) : (
                <div className="log-viewer__empty">
                  <span className="text-secondary">{emptyMessage}</span>
                  {emptyHint ? <span className="text-secondary">{emptyHint}</span> : null}
                </div>
              )}
            </div>
          </section>
          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
};

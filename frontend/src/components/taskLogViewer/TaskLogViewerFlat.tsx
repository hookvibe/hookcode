// Render the flat log viewer variant separate from the main component. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { ReactNode, RefObject } from 'react';
import { Alert, Typography } from 'antd';
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
  rootRef,
  endRef,
  messageContextHolder
}: TaskLogViewerFlatProps) => (
  <div ref={rootRef}>
    {messageContextHolder}
    {error ? <Alert type="warning" showIcon message={error} style={{ marginBottom: 8 }} /> : null}
    {timeline.items.length ? (
      <>
        {/* Show reasoning in flat dialog logs to surface Codex text by default. docs/en/developer/plans/tasklogdialog20260128/task_plan.md tasklogdialog20260128 */}
        <ExecutionTimeline items={timeline.items} showReasoning={showReasoning} wrapDiffLines={true} showLineNumbers={true} />
      </>
    ) : logs.length ? (
      <pre className="hc-task-code-block hc-task-code-block--expanded">{lines}</pre>
    ) : (
      <div className="hc-exec-empty">
        <Typography.Text type="secondary">{t('logViewer.empty')}</Typography.Text>
      </div>
    )}
    <div ref={endRef} />
  </div>
);

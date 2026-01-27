import { FC } from 'react';
import { Skeleton } from '@/ui';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

export interface LogViewerSkeletonProps {
  lines?: number;
  testId?: string;
  ariaLabel?: string;
}

export const LogViewerSkeleton: FC<LogViewerSkeletonProps> = ({ lines = 8, testId, ariaLabel }) => {
  // Render a log-viewer skeleton while the logs feature gate is being resolved. ro3ln7zex8d0wyynfj0m
  const widths = Array.from({ length: Math.max(1, lines) }, (_, i) => `${92 - Math.min(i * 4, 28)}%`);

  return (
    <div aria-busy="true" aria-label={ariaLabel} data-testid={testId}>
      <Skeleton active title={false} paragraph={{ rows: Math.max(1, lines), width: widths }} />
    </div>
  );
};

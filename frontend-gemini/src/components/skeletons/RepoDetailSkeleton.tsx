import { FC } from 'react';
import { Card, Skeleton, Space } from '@/ui';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

export interface RepoDetailSkeletonProps {
  testId?: string;
  ariaLabel?: string;
}

export const RepoDetailSkeleton: FC<RepoDetailSkeletonProps> = ({ testId, ariaLabel }) => {
  // Render a repo-detail skeleton while repository data is being fetched. ro3ln7zex8d0wyynfj0m
  return (
    <Space
      orientation="vertical"
      size={12}
      style={{ width: '100%' }}
      aria-busy="true"
      aria-label={ariaLabel}
      data-testid={testId}
    >
      <Card size="small" className="hc-card">
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Skeleton.Input active size="small" style={{ width: '46%' }} />
          <Skeleton active title={false} paragraph={{ rows: 3, width: ['86%', '72%', '64%'] }} />
        </Space>
      </Card>

      <Card size="small" className="hc-card">
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          <Skeleton.Button active size="small" style={{ width: 72 }} />
          <Skeleton.Button active size="small" style={{ width: 88 }} />
          <Skeleton.Button active size="small" style={{ width: 92 }} />
          <Skeleton.Button active size="small" style={{ width: 84 }} />
        </Space>
        <Skeleton active title={false} paragraph={{ rows: 8, width: ['96%', '92%', '90%', '88%', '86%', '80%', '78%', '60%'] }} />
      </Card>
    </Space>
  );
};

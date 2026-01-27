import { FC } from 'react';
import { Card, Skeleton, Space } from '@/ui';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

export interface LoginCardSkeletonProps {
  testId?: string;
  ariaLabel?: string;
}

export const LoginCardSkeleton: FC<LoginCardSkeletonProps> = ({ testId, ariaLabel }) => {
  // Render a login-card skeleton while the app is checking auth capability. ro3ln7zex8d0wyynfj0m
  return (
    <Card className="hc-login__card" aria-busy="true" aria-label={ariaLabel} data-testid={testId}>
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        <Skeleton.Input active size="default" style={{ width: 220 }} />
        <Skeleton.Input active size="small" style={{ width: 300, maxWidth: '100%' }} />

        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <Skeleton.Input active size="large" style={{ width: '100%' }} />
          <Skeleton.Input active size="large" style={{ width: '100%' }} />
          <Skeleton.Button active size="large" style={{ width: '100%' }} />
        </Space>

        <Skeleton active title={false} paragraph={{ rows: 2, width: ['65%', '45%'] }} />
      </Space>
    </Card>
  );
};

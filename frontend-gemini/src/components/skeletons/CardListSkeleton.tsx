import { FC, useMemo } from 'react';
import { Card, Skeleton, Space } from '@/ui';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

export interface CardListSkeletonProps {
  count?: number;
  cardClassName?: string;
  testId?: string;
  ariaLabel?: string;
}

export const CardListSkeleton: FC<CardListSkeletonProps> = ({
  count = 6,
  cardClassName,
  testId,
  ariaLabel
}) => {
  // Render a consistent card-list skeleton for list pages while data is loading. ro3ln7zex8d0wyynfj0m
  const items = useMemo(() => Array.from({ length: Math.max(1, count) }, (_, i) => i), [count]);

  return (
    <div className="hc-card-list" aria-busy="true" aria-label={ariaLabel} data-testid={testId}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        {items.map((i) => (
          <Card
            // `i` is stable enough for a fixed-size placeholder list.
            key={i}
            size="small"
            className={cardClassName}
            styles={{ body: { padding: 12 } }}
          >
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Skeleton.Input active size="small" style={{ width: '62%' }} />
              <Space size={8} wrap>
                <Skeleton.Button active size="small" style={{ width: 88 }} />
                <Skeleton.Button active size="small" style={{ width: 110 }} />
                <Skeleton.Button active size="small" style={{ width: 96 }} />
              </Space>
            </Space>
          </Card>
        ))}
      </Space>
    </div>
  );
};

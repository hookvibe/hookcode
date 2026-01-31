import { FC, useMemo } from 'react';
import { Card, Skeleton, Space } from 'antd';

export interface CardListSkeletonProps {
  count?: number;
  cardClassName?: string;
  layout?: 'stack' | 'grid';
  testId?: string;
  ariaLabel?: string;
}

export const CardListSkeleton: FC<CardListSkeletonProps> = ({
  count = 6,
  cardClassName,
  layout = 'stack',
  testId,
  ariaLabel
}) => {
  // Render a consistent card-list skeleton for list pages while data is loading. ro3ln7zex8d0wyynfj0m
  const items = useMemo(() => Array.from({ length: Math.max(1, count) }, (_, i) => i), [count]);

  return (
    <div className="hc-card-list" aria-busy="true" aria-label={ariaLabel} data-testid={testId}>
      {/* Switch between stacked and grid skeleton layouts to match the list container. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
      {layout === 'grid' ? (
        <div className="hc-card-grid">
          {items.map((i) => (
            <Card
              // `i` is stable enough for a fixed-size placeholder list.
              key={i}
              size="small"
              className={cardClassName}
              // Match skeleton padding to the modernized list cards. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
              styles={{ body: { padding: 14 } }}
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
        </div>
      ) : (
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          {items.map((i) => (
            <Card
              // `i` is stable enough for a fixed-size placeholder list.
              key={i}
              size="small"
              className={cardClassName}
              // Match skeleton padding to the modernized list cards. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
              styles={{ body: { padding: 14 } }}
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
      )}
    </div>
  );
};

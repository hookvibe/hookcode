import { FC } from 'react';
import { Card, Skeleton, Space } from 'antd';

export interface TaskDetailSkeletonProps {
  testId?: string;
  ariaLabel?: string;
}

export const TaskDetailSkeleton: FC<TaskDetailSkeletonProps> = ({ testId, ariaLabel }) => {
  // Render a task-detail skeleton while task data is being fetched. ro3ln7zex8d0wyynfj0m
  return (
    <div className="hc-task-detail-layout" aria-busy="true" aria-label={ariaLabel} data-testid={testId}>
      <div className="hc-task-detail-sidebar">
        <Card size="small" className="hc-card">
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Skeleton.Input active size="small" style={{ width: '44%' }} />
            <Skeleton active title={false} paragraph={{ rows: 10, width: ['96%', '88%', '92%', '86%', '78%', '90%', '84%', '70%', '76%', '60%'] }} />
          </Space>
        </Card>
      </div>

      <div className="hc-task-detail-workflow">
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          <Card size="small" className="hc-card">
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Skeleton.Input active size="small" style={{ width: '36%' }} />
              <Skeleton active title={false} paragraph={{ rows: 6, width: ['96%', '92%', '90%', '86%', '82%', '74%'] }} />
            </Space>
          </Card>

          <Card size="small" className="hc-card">
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              <Skeleton.Input active size="small" style={{ width: '32%' }} />
              <Skeleton active title={false} paragraph={{ rows: 8, width: ['96%', '94%', '90%', '88%', '84%', '78%', '74%', '60%'] }} />
            </Space>
          </Card>
        </Space>
      </div>
    </div>
  );
};


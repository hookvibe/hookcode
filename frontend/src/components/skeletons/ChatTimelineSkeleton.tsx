import { FC, useMemo } from 'react';
import { Card, Skeleton, Space } from 'antd';

export interface ChatTimelineSkeletonProps {
  count?: number;
  testId?: string;
  ariaLabel?: string;
}

export const ChatTimelineSkeleton: FC<ChatTimelineSkeletonProps> = ({ count = 3, testId, ariaLabel }) => {
  // Render a chat-timeline skeleton while a task group is being fetched. ro3ln7zex8d0wyynfj0m
  const items = useMemo(() => Array.from({ length: Math.max(1, count) }, (_, i) => i), [count]);

  return (
    <div className="hc-chat-timeline" aria-busy="true" aria-label={ariaLabel} data-testid={testId}>
      {items.map((i) => (
        <div key={i} className="hc-chat-item">
          <div className="hc-chat-item__user">
            <div className="hc-chat-bubble hc-chat-bubble--user">
              <Skeleton.Input active size="small" style={{ width: `${40 + (i % 3) * 15}%` }} />
            </div>
          </div>

          <div className="hc-chat-item__assistant">
            <Card size="small" className="hc-chat-task-card" styles={{ body: { padding: 12 } }}>
              <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                <Skeleton.Input active size="small" style={{ width: `${55 + (i % 2) * 15}%` }} />
                <Space size={8} wrap>
                  <Skeleton.Button active size="small" style={{ width: 96 }} />
                  <Skeleton.Button active size="small" style={{ width: 120 }} />
                </Space>
              </Space>
            </Card>
          </div>

          <div className="hc-chat-item__assistant">
            <Card size="small" className="hc-chat-logs-card" styles={{ body: { padding: 12 } }}>
              <Skeleton active title={false} paragraph={{ rows: 6, width: ['96%', '92%', '88%', '84%', '80%', '70%'] }} />
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
};


import { Card, Descriptions, Space, Tag, Typography } from 'antd';
import { useMemo } from 'react';
import type { Task } from '../../api';
import { useT } from '../../i18n';

interface TaskProviderRoutingPanelProps {
  task: Task;
  variant?: 'full' | 'compact';
}

const providerColor = (provider?: string) => {
  if (provider === 'codex') return 'blue';
  if (provider === 'claude_code') return 'gold';
  if (provider === 'gemini_cli') return 'green';
  return 'default';
};

export const TaskProviderRoutingPanel = ({ task, variant = 'full' }: TaskProviderRoutingPanelProps) => {
  const t = useT();
  const routing = task.result?.providerRouting;

  const summary = useMemo(() => {
    if (!routing) return null;
    const finalProvider = routing.finalProvider ?? routing.selectedProvider;
    const finalAttempt = routing.attempts.find((attempt) => attempt.provider === finalProvider) ?? null;
    return { finalProvider, finalAttempt };
  }, [routing]);

  if (!routing || !summary) return null;

  if (variant === 'compact') {
    return (
      <Space size={8} wrap>
        <Typography.Text type="secondary">{t('tasks.providerRouting.compactLabel')}</Typography.Text>
        <Tag color={providerColor(summary.finalProvider)}>{summary.finalProvider}</Tag>
        {routing.failoverTriggered ? <Tag color="orange">{t('tasks.providerRouting.failoverTriggered')}</Tag> : null}
      </Space>
    );
  }

  return (
    <Card size="small" className="hc-card" title={t('tasks.providerRouting.title')}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Text type="secondary">{routing.selectionReason}</Typography.Text>
        <Descriptions size="small" column={2}>
          <Descriptions.Item label={t('tasks.providerRouting.primary')}>
            <Tag color={providerColor(routing.primaryProvider)}>{routing.primaryProvider}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('tasks.providerRouting.selected')}>
            <Tag color={providerColor(routing.selectedProvider)}>{routing.selectedProvider}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('tasks.providerRouting.final')}>
            <Tag color={providerColor(summary.finalProvider)}>{summary.finalProvider}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('tasks.providerRouting.fallback')}>
            {routing.fallbackProvider ? <Tag color={providerColor(routing.fallbackProvider)}>{routing.fallbackProvider}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label={t('tasks.providerRouting.mode')}>{routing.mode}</Descriptions.Item>
          <Descriptions.Item label={t('tasks.providerRouting.failoverPolicy')}>{routing.failoverPolicy}</Descriptions.Item>
        </Descriptions>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {routing.attempts.map((attempt) => (
            <Card
              key={`${attempt.provider}-${attempt.role}`}
              size="small"
              styles={{ body: { padding: 12 } }}
              title={
                <Space size={8} wrap>
                  <Tag color={providerColor(attempt.provider)}>{attempt.provider}</Tag>
                  <Tag>{attempt.role}</Tag>
                  <Tag color={attempt.status === 'succeeded' ? 'green' : attempt.status === 'failed' ? 'red' : attempt.status === 'running' ? 'processing' : 'default'}>
                    {attempt.status}
                  </Tag>
                </Space>
              }
            >
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {attempt.reason ? <Typography.Text>{attempt.reason}</Typography.Text> : null}
                {attempt.error ? <Typography.Text type="danger">{attempt.error}</Typography.Text> : null}
                <Typography.Text type="secondary">
                  {t('tasks.providerRouting.credential')}: {attempt.credential.resolvedLayer} / {attempt.credential.resolvedMethod}
                  {attempt.credential.profileId ? ` / ${attempt.credential.profileId}` : ''}
                </Typography.Text>
              </Space>
            </Card>
          ))}
        </Space>
      </Space>
    </Card>
  );
};


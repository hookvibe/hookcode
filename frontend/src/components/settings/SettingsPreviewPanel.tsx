import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, List, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { fetchPreviewAdminOverview } from '../../api';
import type { PreviewInstanceStatus, PreviewManagedTaskGroupSummary, PreviewPortAllocationSnapshot } from '../../api';
import { useT } from '../../i18n';

const statusColor = (status: PreviewInstanceStatus): string => {
  if (status === 'running') return 'green';
  if (status === 'starting') return 'blue';
  if (status === 'failed') return 'red';
  if (status === 'timeout') return 'gold';
  return 'default';
};

const formatTime = (value?: string | null): string => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

// Render admin-only preview management cards for active task groups and port allocation state. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export const SettingsPreviewPanel: FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [taskGroups, setTaskGroups] = useState<PreviewManagedTaskGroupSummary[]>([]);
  const [portAllocation, setPortAllocation] = useState<PreviewPortAllocationSnapshot | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPreviewAdminOverview();
      setGeneratedAt(data.generatedAt ?? null);
      setTaskGroups(Array.isArray(data.activeTaskGroups) ? data.activeTaskGroups : []);
      setPortAllocation(data.portAllocation ?? null);
    } catch (err: any) {
      setError(err?.message || t('panel.preview.error.loadFailed'));
      setGeneratedAt(null);
      setTaskGroups([]);
      setPortAllocation(null);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const portRange = useMemo(() => {
    if (!portAllocation) return '-';
    return `${portAllocation.rangeStart} - ${portAllocation.rangeEnd}`;
  }, [portAllocation]);

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
        <Typography.Text type="secondary">
          {t('panel.preview.generatedAt')}: {formatTime(generatedAt)}
        </Typography.Text>
        <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
          {t('panel.preview.refresh')}
        </Button>
      </Space>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Card title={t('panel.preview.port.title')} size="small" loading={loading}>
        <Space wrap>
          <Tag>{t('panel.preview.port.range', { range: portRange })}</Tag>
          <Tag color="blue">{t('panel.preview.port.capacity', { count: portAllocation?.capacity ?? 0 })}</Tag>
          <Tag color="green">{t('panel.preview.port.inUse', { count: portAllocation?.inUseCount ?? 0 })}</Tag>
          <Tag>{t('panel.preview.port.available', { count: portAllocation?.availableCount ?? 0 })}</Tag>
        </Space>
        <div style={{ marginTop: 12 }}>
          {portAllocation?.allocations?.length ? (
            <List
              size="small"
              dataSource={portAllocation.allocations}
              renderItem={(item) => (
                <List.Item>
                  <Space>
                    <Typography.Text code>{item.taskGroupId}</Typography.Text>
                    <Typography.Text type="secondary">{item.ports.join(', ')}</Typography.Text>
                  </Space>
                </List.Item>
              )}
            />
          ) : (
            <Typography.Text type="secondary">{t('panel.preview.port.allocationsEmpty')}</Typography.Text>
          )}
        </div>
      </Card>

      <Card
        title={t('panel.preview.groups.title', { count: taskGroups.length })}
        size="small"
        loading={loading}
      >
        {taskGroups.length ? (
          <List
            size="small"
            dataSource={taskGroups}
            renderItem={(group) => (
              <List.Item>
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space wrap>
                    <Typography.Text strong>{group.taskGroupTitle || group.taskGroupId}</Typography.Text>
                    <Typography.Text code>{group.taskGroupId}</Typography.Text>
                    {group.repoId ? <Tag>{t('panel.preview.groups.repo', { repoId: group.repoId })}</Tag> : null}
                    <Tag color={statusColor(group.aggregateStatus)}>{t(`preview.status.${group.aggregateStatus}` as any)}</Tag>
                  </Space>
                  <Space wrap>
                    {group.instances.map((instance) => (
                      <Tag key={`${group.taskGroupId}-${instance.name}`} color={statusColor(instance.status)}>
                        {instance.name}: {t(`preview.status.${instance.status}` as any)}
                        {instance.port ? ` (${instance.port})` : ''}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </List.Item>
            )}
          />
        ) : (
          <Empty description={t('panel.preview.groups.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </Card>
    </Space>
  );
};

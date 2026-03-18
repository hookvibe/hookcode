import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Radio, Space, Spin, Typography } from 'antd';
import type { ApprovalRequest, ApprovalRequestStatus } from '../../api';
import { fetchApprovals } from '../../api';
import { useT } from '../../i18n';
import { ApprovalRequestPanel } from '../approvals/ApprovalRequestPanel';

type ApprovalFilter = ApprovalRequestStatus | 'all';

const FILTERS: ApprovalFilter[] = ['pending', 'approved', 'rejected', 'changes_requested', 'all'];

export const SettingsApprovalsPanel: FC = () => {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [filter, setFilter] = useState<ApprovalFilter>('pending');
  const [error, setError] = useState('');

  const loadApprovals = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchApprovals({
        status: filter === 'all' ? undefined : filter,
        limit: 100
      });
      setApprovals(Array.isArray(response.approvals) ? response.approvals : []);
    } catch (error: any) {
      console.error(error);
      setApprovals([]);
      setError(error?.message || t('approval.toast.fetchFailed'));
    } finally {
      setLoading(false);
    }
  }, [filter, t]);

  useEffect(() => {
    void loadApprovals();
  }, [loadApprovals]);

  const countText = useMemo(
    () => t('approval.inbox.count', { count: approvals.length }),
    [approvals.length, t]
  );

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Space wrap>
        <Button onClick={() => void loadApprovals()} loading={loading}>
          {t('common.refresh')}
        </Button>
        <Radio.Group
          optionType="button"
          buttonStyle="solid"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          options={FILTERS.map((value) => ({
            value,
            label:
              value === 'all'
                ? t('approval.filter.all')
                : t(`approval.status.${value}` as never)
          }))}
        />
        <Typography.Text type="secondary">{countText}</Typography.Text>
      </Space>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      {loading ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <Spin />
        </div>
      ) : approvals.length ? (
        <Space orientation="vertical" size={12} style={{ width: '100%' }}>
          {approvals.map((approval) => (
            <ApprovalRequestPanel
              key={approval.id}
              approval={approval}
              showTaskLink
              onUpdated={() => void loadApprovals()}
            />
          ))}
        </Space>
      ) : (
        <Empty description={t('approval.inbox.empty')} />
      )}
    </Space>
  );
};

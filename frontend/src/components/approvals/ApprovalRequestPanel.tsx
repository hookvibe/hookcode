import { FC, useState } from 'react';
import { App, Button, Card, Input, Space, Tag, Typography } from 'antd';
import { CheckOutlined, EditOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { ApprovalActionRecord, ApprovalRequest, Task } from '../../api';
import {
  approveApprovalRequest,
  approveApprovalAlways,
  getApprovalErrorMessage,
  rejectApprovalRequest,
  requestApprovalChanges
} from '../../api';
import { useLocale, useT } from '../../i18n';
import { buildTaskHash } from '../../router';

type ApprovalPanelVariant = 'full' | 'compact';

const approvalStatusColor = (status: ApprovalRequest['status']): string => {
  if (status === 'approved') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'changes_requested') return 'orange';
  return 'gold';
};

const approvalActionLabelKey = (action: ApprovalActionRecord['action']) => {
  if (action === 'requested') return 'approval.action.requested';
  if (action === 'approve') return 'approval.action.approve';
  if (action === 'reject') return 'approval.action.reject';
  if (action === 'request_changes') return 'approval.action.requestChanges';
  if (action === 'approve_once') return 'approval.action.approveOnce';
  if (action === 'approve_always_robot') return 'approval.action.approveAlwaysRobot';
  if (action === 'approve_always_rule') return 'approval.action.approveAlwaysRule';
  return 'approval.action.approveAlways';
};

const riskColor = (riskLevel: ApprovalRequest['riskLevel']): string => {
  if (riskLevel === 'critical') return 'red';
  if (riskLevel === 'high') return 'volcano';
  if (riskLevel === 'medium') return 'gold';
  return 'blue';
};

const formatDateTime = (locale: string, value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const renderInlineList = (values: string[], emptyText: string) => {
  if (!values.length) return <Typography.Text type="secondary">{emptyText}</Typography.Text>;
  return (
    <Space size={[6, 6]} wrap>
      {values.map((value) => (
        <Tag key={value} variant="filled" style={{ marginInlineEnd: 0 }}>
          <Typography.Text code>{value}</Typography.Text>
        </Tag>
      ))}
    </Space>
  );
};

export interface ApprovalRequestPanelProps {
  approval: ApprovalRequest;
  task?: Task | null;
  variant?: ApprovalPanelVariant;
  canManage?: boolean;
  showTaskLink?: boolean;
  onUpdated?: (approval: ApprovalRequest) => void | Promise<void>;
}

export const ApprovalRequestPanel: FC<ApprovalRequestPanelProps> = ({
  approval,
  task,
  variant = 'full',
  canManage,
  showTaskLink = false,
  onUpdated
}) => {
  const t = useT();
  const locale = useLocale();
  const { message } = App.useApp();
  const [note, setNote] = useState('');
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const actionable = approval.status === 'pending' && (canManage ?? task?.permissions?.canManage ?? true);
  const actions = Array.isArray(approval.actions) ? approval.actions : [];
  const history = variant === 'compact' ? actions.slice(-2).reverse() : [...actions].reverse();
  const details = approval.details;
  const matchedRule = Array.isArray(details?.matchedRules) ? details.matchedRules[0] : undefined;
  const reasons = Array.isArray(details?.reasons) ? details.reasons : [];
  const warnings = Array.isArray(details?.warnings) ? details.warnings ?? [] : [];
  const commands = Array.isArray(details?.commands) ? details.commands : [];
  const targetFiles = Array.isArray(details?.targetFiles) ? details.targetFiles : [];

  const runAction = async (actionKey: string, request: () => Promise<ApprovalRequest>, successKey: string) => {
    setLoadingKey(actionKey);
    try {
      const updated = await request();
      message.success(t(successKey as never));
      setNote('');
      await onUpdated?.(updated);
    } catch (error) {
      console.error(error);
      message.error(getApprovalErrorMessage(error) || t('approval.toast.actionFailed'));
    } finally {
      setLoadingKey((current) => (current === actionKey ? null : current));
    }
  };

  return (
    <Card
      size="small"
      className={variant === 'compact' ? 'hc-card hc-card--compact' : 'hc-card'}
      title={
        <Space size={8} wrap>
          <Typography.Text strong>{t('approval.title')}</Typography.Text>
          <Tag color={riskColor(approval.riskLevel)}>{t(`approval.risk.${approval.riskLevel}` as never)}</Tag>
          <Tag color={approvalStatusColor(approval.status)}>{t(`approval.status.${approval.status}` as never)}</Tag>
          <Tag color={approval.decision === 'require_approval' ? 'gold' : 'blue'}>
            {t(`approval.decision.${approval.decision}` as never)}
          </Tag>
        </Space>
      }
      extra={
        showTaskLink ? (
          <Typography.Link href={buildTaskHash(approval.taskId)}>{t('approval.openTask')}</Typography.Link>
        ) : null
      }
      styles={{ body: { padding: variant === 'compact' ? 14 : 16 } }}
    >
      <Space orientation="vertical" size={variant === 'compact' ? 10 : 12} style={{ width: '100%' }}>
        <Typography.Text strong>{approval.summary}</Typography.Text>

        <Space size={[6, 6]} wrap>
          {matchedRule?.name ? <Tag>{t('approval.rule', { value: matchedRule.name })}</Tag> : null}
          {details?.provider ? <Tag>{t('approval.provider', { value: details.provider })}</Tag> : null}
          {details?.sandbox ? <Tag>{t('approval.sandbox', { value: details.sandbox })}</Tag> : null}
          <Tag color={details?.networkAccess ? 'volcano' : 'default'}>
            {details?.networkAccess ? t('approval.network.enabled') : t('approval.network.disabled')}
          </Tag>
          {task?.status === 'waiting_approval' ? <Tag color="gold">{t('task.status.waiting_approval')}</Tag> : null}
        </Space>

        <div>
          <Typography.Text type="secondary">{t('approval.section.reasons')}</Typography.Text>
          <div>{renderInlineList(reasons, t('approval.empty.reasons'))}</div>
        </div>

        {warnings.length ? (
          <div>
            <Typography.Text type="secondary">{t('approval.section.warnings')}</Typography.Text>
            <div>{renderInlineList(warnings, t('approval.empty.warnings'))}</div>
          </div>
        ) : null}

        <div>
          <Typography.Text type="secondary">{t('approval.section.paths')}</Typography.Text>
          <div>{renderInlineList(targetFiles, t('approval.empty.paths'))}</div>
        </div>

        <div>
          <Typography.Text type="secondary">{t('approval.section.commands')}</Typography.Text>
          <div>{renderInlineList(commands, t('approval.empty.commands'))}</div>
        </div>

        <Space size={[12, 4]} wrap>
          <Typography.Text type="secondary">
            {t('approval.requestedAt', { value: formatDateTime(locale, approval.createdAt) })}
          </Typography.Text>
          {approval.resolvedAt ? (
            <Typography.Text type="secondary">
              {t('approval.resolvedAt', { value: formatDateTime(locale, approval.resolvedAt) })}
            </Typography.Text>
          ) : null}
          {details?.taskSource ? (
            <Typography.Text type="secondary">{t('approval.source', { value: details.taskSource })}</Typography.Text>
          ) : null}
        </Space>

        {history.length ? (
          <div>
            <Typography.Text type="secondary">{t('approval.section.history')}</Typography.Text>
            <Space orientation="vertical" size={6} style={{ width: '100%' }}>
              {history.map((item) => (
                <div key={item.id}>
                  <Space size={[8, 4]} wrap>
                    <Tag color={item.action.includes('reject') || item.action === 'request_changes' ? 'red' : 'blue'}>
                      {t(approvalActionLabelKey(item.action) as never)}
                    </Tag>
                    <Typography.Text type="secondary">{formatDateTime(locale, item.createdAt)}</Typography.Text>
                    {item.actorUserId ? (
                      <Typography.Text type="secondary">{t('approval.actor', { value: item.actorUserId })}</Typography.Text>
                    ) : null}
                  </Space>
                  {item.note ? (
                    <Typography.Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 4 }}>
                      {item.note}
                    </Typography.Paragraph>
                  ) : null}
                </div>
              ))}
            </Space>
          </div>
        ) : null}

        {actionable ? (
          <Space orientation="vertical" size={10} style={{ width: '100%' }}>
            <Input.TextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              autoSize={{ minRows: variant === 'compact' ? 2 : 3, maxRows: 6 }}
              placeholder={t('approval.notePlaceholder')}
            />
            <Space size={[8, 8]} wrap>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={loadingKey === 'approve'}
                onClick={() =>
                  void runAction(
                    'approve',
                    () => approveApprovalRequest(approval.id, { note }),
                    'approval.toast.approved'
                  )
                }
              >
                {t('approval.action.approve')}
              </Button>
              <Button
                danger
                icon={<StopOutlined />}
                loading={loadingKey === 'reject'}
                onClick={() =>
                  void runAction('reject', () => rejectApprovalRequest(approval.id, { note }), 'approval.toast.rejected')
                }
              >
                {t('approval.action.reject')}
              </Button>
              <Button
                icon={<EditOutlined />}
                loading={loadingKey === 'request_changes'}
                onClick={() =>
                  void runAction(
                    'request_changes',
                    () => requestApprovalChanges(approval.id, { note }),
                    'approval.toast.changesRequested'
                  )
                }
              >
                {t('approval.action.requestChanges')}
              </Button>
              <Button
                icon={<ThunderboltOutlined />}
                loading={loadingKey === 'approve_always'}
                onClick={() =>
                  void runAction(
                    'approve_always',
                    () => approveApprovalAlways(approval.id, { note }),
                    'approval.toast.approvedAlways'
                  )
                }
              >
                {t('approval.action.approveAlways')}
              </Button>
            </Space>
          </Space>
        ) : null}
      </Space>
    </Card>
  );
};

// Render the webhook setup onboarding step with verification status. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Alert, Button, Card, Radio, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { TFunction } from '../../../i18n';

export type RepoOnboardingWebhookStepProps = {
  t: TFunction;
  enableWebhookChoice: 'yes' | 'no';
  setEnableWebhookChoice: (next: 'yes' | 'no') => void;
  webhookUrl: string;
  webhookSecret?: string | null;
  webhookVerified: boolean;
  webhookIsLocal: boolean;
  onOpenWebhookIntro: () => void;
  onRefreshRepo: () => void;
};

export const RepoOnboardingWebhookStep = ({
  t,
  enableWebhookChoice,
  setEnableWebhookChoice,
  webhookUrl,
  webhookSecret,
  webhookVerified,
  webhookIsLocal,
  onOpenWebhookIntro,
  onRefreshRepo
}: RepoOnboardingWebhookStepProps) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Typography.Paragraph style={{ marginBottom: 0 }}>{t('repos.onboarding.webhook.desc')}</Typography.Paragraph>

    <Radio.Group value={enableWebhookChoice} onChange={(e) => setEnableWebhookChoice(e.target.value)} optionType="button" buttonStyle="solid">
      <Radio.Button value="yes">{t('repos.onboarding.webhook.yes')}</Radio.Button>
      <Radio.Button value="no">{t('repos.onboarding.webhook.no')}</Radio.Button>
    </Radio.Group>

    {enableWebhookChoice === 'yes' ? (
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {webhookIsLocal ? <Alert type="warning" showIcon message={t('repos.onboarding.webhook.localhostWarning')} /> : null}

        <Card size="small" className="hc-card" title={t('repos.onboarding.webhook.cardTitle')}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {t('repos.onboarding.webhook.url')}：
              <Typography.Text code copyable style={{ wordBreak: 'break-all' }}>
                {webhookUrl || '-'}
              </Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {t('repos.onboarding.webhook.secret')}：
              <Typography.Text code copyable={webhookSecret ? { text: webhookSecret } : false} style={{ wordBreak: 'break-all' }}>
                {webhookSecret ? '••••••••••••••••' : '-'}
              </Typography.Text>
            </Typography.Paragraph>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {t('repos.onboarding.webhook.status')}:{' '}
              {webhookVerified ? <Tag color="green">{t('repos.onboarding.webhook.verified')}</Tag> : <Tag color="gold">{t('repos.onboarding.webhook.notVerified')}</Tag>}
            </Typography.Paragraph>
            <Space size={10} wrap>
              <Button type="primary" onClick={onOpenWebhookIntro}>
                {t('repos.onboarding.webhook.openGuide')}
              </Button>
              <Button icon={<ReloadOutlined />} onClick={onRefreshRepo}>
                {t('repos.onboarding.webhook.refresh')}
              </Button>
            </Space>
            {!webhookVerified ? <Alert type="info" showIcon message={t('repos.onboarding.webhook.waiting')} /> : null}
          </Space>
        </Card>
      </Space>
    ) : (
      <Alert type="info" showIcon message={t('repos.onboarding.webhook.skipTip')} />
    )}
  </Space>
);

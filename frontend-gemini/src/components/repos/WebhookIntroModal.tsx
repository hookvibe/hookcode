import { FC, useEffect, useState } from 'react';
import { Alert, Button, Space, Typography } from '@/ui';
import type { RepoProvider } from '../../api';
import { useT } from '../../i18n';
import { ResponsiveDialog } from '../dialogs/ResponsiveDialog';
import { isLocalhostUrl } from '../../utils/url';
// Switch to custom UI components to remove legacy UI dependency. docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127

/**
 * WebhookIntroModal:
 * - Business context: guide users to configure provider Webhooks so repo automation/robots can be activated.
 * - Module: RepoDetail -> Webhooks tab.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to `frontend-chat`.
 */

export interface WebhookIntroModalProps {
  open: boolean;
  provider: RepoProvider;
  webhookUrl: string;
  webhookSecret?: string | null;
  onClose: () => void;
}

const providerLabel = (provider: RepoProvider) => (provider === 'github' ? 'GitHub' : 'GitLab');

export const WebhookIntroModal: FC<WebhookIntroModalProps> = ({ open, provider, webhookUrl, webhookSecret, onClose }) => {
  const t = useT();
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const isLocalWebhookUrl = isLocalhostUrl(webhookUrl); // Warn users that localhost URLs cannot be reached by SaaS providers. 58w1q3n5nr58flmempxe

  useEffect(() => {
    if (!open) setShowWebhookSecret(false);
  }, [open]);

  return (
    <ResponsiveDialog
      variant="compact"
      title={t('repos.webhookIntro.title')}
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('common.close')}</Button>}
      modalWidth={720}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        {isLocalWebhookUrl ? <Alert type="warning" showIcon message={t('repos.webhookIntro.localhostWarning')} /> : null}
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          {t('repos.webhookIntro.step1', { provider: providerLabel(provider) })}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {provider === 'gitlab' ? t('repos.webhookIntro.gitlab.scopeNote') : t('repos.webhookIntro.github.scopeNote')}
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          - {t('repos.webhookIntro.webhookUrl')}：
          <Typography.Text code copyable style={{ wordBreak: 'break-all' }}>
            {webhookUrl}
          </Typography.Text>
        </Typography.Paragraph>
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          - {t('repos.webhookIntro.secret')}：{' '}
          {webhookSecret ? (
            <Space size={8}>
              <Typography.Text code copyable={{ text: webhookSecret }} style={{ wordBreak: 'break-all' }}>
                {showWebhookSecret ? webhookSecret : '••••••••••••••••'}
              </Typography.Text>
              <Button type="link" size="small" onClick={() => setShowWebhookSecret((v) => !v)}>
                {showWebhookSecret ? t('repos.webhookIntro.hide') : t('repos.webhookIntro.show')}
              </Button>
            </Space>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          )}
        </Typography.Paragraph>

        {provider === 'gitlab' ? (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('repos.webhookIntro.gitlab.step2')}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('repos.webhookIntro.gitlab.step3')}
            </Typography.Paragraph>
          </>
        ) : (
          <>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('repos.webhookIntro.github.step2')}
            </Typography.Paragraph>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              {t('repos.webhookIntro.github.step3')}
            </Typography.Paragraph>
          </>
        )}
      </Space>
    </ResponsiveDialog>
  );
};
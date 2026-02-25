// Render the repo visibility onboarding step UI with shared state inputs. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { Alert, Button, Card, Radio, Select, Skeleton, Space, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { RepoProviderVisibility } from '../../../api';
import type { TFunction } from '../../../i18n';
import { visibilityTag, type CredentialSource } from './useRepoOnboardingVisibility';

export type RepoOnboardingVisibilityStepProps = {
  t: TFunction;
  credentialSource: CredentialSource;
  setCredentialSource: (next: CredentialSource) => void;
  credentialProfileId: string;
  setCredentialProfileId: (next: string) => void;
  userModelCredentialsLoading?: boolean;
  userModelCredentialsError?: boolean;
  profileOptions: Array<{ value: string; label: string }>;
  canDetectVisibility: boolean;
  visibilityLoading: boolean;
  visibilityError: string;
  visibilityHint: string;
  visibility: RepoProviderVisibility;
  visibilityUrl: string;
  onDetectVisibility: () => void;
  onOpenRepoProviderCredential: () => void;
};

export const RepoOnboardingVisibilityStep = ({
  t,
  credentialSource,
  setCredentialSource,
  credentialProfileId,
  setCredentialProfileId,
  userModelCredentialsLoading,
  userModelCredentialsError,
  profileOptions,
  canDetectVisibility,
  visibilityLoading,
  visibilityError,
  visibilityHint,
  visibility,
  visibilityUrl,
  onDetectVisibility,
  onOpenRepoProviderCredential
}: RepoOnboardingVisibilityStepProps) => (
  <Space direction="vertical" size={12} style={{ width: '100%' }}>
    <Typography.Paragraph style={{ marginBottom: 0 }}>{t('repos.onboarding.visibility.desc')}</Typography.Paragraph>

    <Card size="small" className="hc-card" title={t('repos.onboarding.visibility.detectTitle')}>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Radio.Group
          value={credentialSource}
          onChange={(e) => setCredentialSource(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="user">{t('repos.onboarding.visibility.credentialSource.user')}</Radio.Button>
          <Radio.Button value="repo">{t('repos.onboarding.visibility.credentialSource.repo')}</Radio.Button>
          <Radio.Button value="anonymous">{t('repos.onboarding.visibility.credentialSource.anonymous')}</Radio.Button>
        </Radio.Group>

        {credentialSource !== 'anonymous' ? (
          userModelCredentialsLoading && credentialSource === 'user' ? (
            // Use Skeleton for loading states per frontend guidelines. ro3ln7zex8d0wyynfj0m
            <Skeleton active paragraph={{ rows: 2 }} />
          ) : (
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              {userModelCredentialsError && credentialSource === 'user' ? (
                <Alert type="warning" showIcon message={t('repos.onboarding.visibility.userCredentialsLoadFailed')} />
              ) : null}

              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder={t('repos.onboarding.visibility.profilePlaceholder')}
                value={credentialProfileId || undefined}
                onChange={(value) => setCredentialProfileId(String(value ?? ''))}
                options={profileOptions}
              />

              {credentialSource === 'repo' ? (
                <Button onClick={onOpenRepoProviderCredential}>{t('repos.onboarding.visibility.addRepoCredential')}</Button>
              ) : null}
            </Space>
          )
        ) : (
          <Alert type="info" showIcon message={t('repos.onboarding.visibility.anonymousTip')} />
        )}

        <Space size={10} wrap>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={visibilityLoading}
            disabled={!canDetectVisibility}
            onClick={onDetectVisibility}
          >
            {t('repos.onboarding.visibility.detect')}
          </Button>
          <Space size={8} wrap>
            {visibilityTag(t, visibility)}
            {visibilityUrl ? (
              <Typography.Link href={visibilityUrl} target="_blank" rel="noreferrer">
                {t('repos.onboarding.visibility.openInProvider')}
              </Typography.Link>
            ) : null}
          </Space>
        </Space>

        {visibilityError ? <Alert type="warning" showIcon message={visibilityError} /> : null}

        <Alert type="info" showIcon message={visibilityHint} />
      </Space>
    </Card>
  </Space>
);

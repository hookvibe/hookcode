import { FC, useMemo, useState } from 'react';
import { Button, Card, Space, Steps, Typography } from 'antd';
import type { RepoRobot, RepoScopedCredentialsPublic, Repository, UserModelCredentialsPublic } from '../../api';
import { useT } from '../../i18n';
import { isLocalhostUrl } from '../../utils/url';
import { RepoOnboardingChatStep } from './onboarding/RepoOnboardingChatStep';
import { RepoOnboardingDoneStep } from './onboarding/RepoOnboardingDoneStep';
import { RepoOnboardingRobotStep } from './onboarding/RepoOnboardingRobotStep';
import { RepoOnboardingVisibilityStep } from './onboarding/RepoOnboardingVisibilityStep';
import { RepoOnboardingWebhookStep } from './onboarding/RepoOnboardingWebhookStep';
import { useRepoOnboardingChat } from './onboarding/useRepoOnboardingChat';
import { useRepoOnboardingVisibility } from './onboarding/useRepoOnboardingVisibility';

// RepoOnboardingWizard renders the first-entry setup flow as orchestrated steps. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

export interface RepoOnboardingWizardProps {
  repo: Repository;
  robots: RepoRobot[];
  repoScopedCredentials: RepoScopedCredentialsPublic | null;
  userModelCredentials: UserModelCredentialsPublic | null;
  userModelCredentialsLoading?: boolean;
  userModelCredentialsError?: boolean;
  webhookUrl: string;
  webhookSecret?: string | null;
  webhookVerifiedAt?: string | null;
  onOpenRepoProviderCredential: () => void;
  onOpenCreateRobot: () => void;
  onOpenWebhookIntro: () => void;
  onRefreshRepo: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export const RepoOnboardingWizard: FC<RepoOnboardingWizardProps> = ({
  repo,
  robots,
  repoScopedCredentials,
  userModelCredentials,
  userModelCredentialsLoading,
  userModelCredentialsError,
  webhookUrl,
  webhookSecret,
  webhookVerifiedAt,
  onOpenRepoProviderCredential,
  onOpenCreateRobot,
  onOpenWebhookIntro,
  onRefreshRepo,
  onSkip,
  onFinish
}) => {
  const t = useT();

  const [step, setStep] = useState(0);
  const [enableWebhookChoice, setEnableWebhookChoice] = useState<'yes' | 'no'>('yes');

  const visibilityState = useRepoOnboardingVisibility({
    repo,
    repoScopedCredentials,
    userModelCredentials,
    step,
    t
  });
  const chatState = useRepoOnboardingChat({ repo, robots, t });

  const webhookVerified = Boolean(webhookVerifiedAt);
  const webhookIsLocal = isLocalhostUrl(webhookUrl);

  const nextDisabled = useMemo(() => {
    // Require webhook verification only when the user explicitly opts into enabling webhooks. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
    if (step !== 3) return false;
    if (enableWebhookChoice === 'no') return false;
    return !webhookVerified;
  }, [enableWebhookChoice, step, webhookVerified]);

  const steps = useMemo(
    () => [
      { title: t('repos.onboarding.steps.visibility') },
      { title: t('repos.onboarding.steps.bot') },
      { title: t('repos.onboarding.steps.chatTest') },
      { title: t('repos.onboarding.steps.webhook') },
      { title: t('repos.onboarding.steps.done') }
    ],
    [t]
  );

  return (
    <Card
      className="hc-card"
      title={
        <Space size={10} wrap>
          <Typography.Text strong>{t('repos.onboarding.title')}</Typography.Text>
          <Typography.Text type="secondary">
            {repo.name || repo.id} · {repo.provider === 'github' ? 'GitHub' : 'GitLab'}
          </Typography.Text>
        </Space>
      }
      extra={
        <Button onClick={onSkip} type="link">
          {t('repos.onboarding.skip')}
        </Button>
      }
    >
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Steps current={step} items={steps} />

        {step === 0 ? (
          <RepoOnboardingVisibilityStep
            t={t}
            credentialSource={visibilityState.credentialSource}
            setCredentialSource={visibilityState.setCredentialSource}
            credentialProfileId={visibilityState.credentialProfileId}
            setCredentialProfileId={visibilityState.setCredentialProfileId}
            userModelCredentialsLoading={userModelCredentialsLoading}
            userModelCredentialsError={userModelCredentialsError}
            profileOptions={visibilityState.profileOptions}
            canDetectVisibility={visibilityState.canDetectVisibility}
            visibilityLoading={visibilityState.visibilityLoading}
            visibilityError={visibilityState.visibilityError}
            visibilityHint={visibilityState.visibilityHint}
            visibility={visibilityState.visibility}
            visibilityUrl={visibilityState.visibilityUrl}
            onDetectVisibility={visibilityState.handleDetectVisibility}
            onOpenRepoProviderCredential={onOpenRepoProviderCredential}
          />
        ) : null}

        {step === 1 ? (
          <RepoOnboardingRobotStep t={t} robotCount={robots.length} onOpenCreateRobot={onOpenCreateRobot} />
        ) : null}

        {step === 2 ? (
          <RepoOnboardingChatStep
            t={t}
            robotOptions={chatState.robotOptions}
            chatRobotId={chatState.chatRobotId}
            setChatRobotId={chatState.setChatRobotId}
            chatDraft={chatState.chatDraft}
            setChatDraft={chatState.setChatDraft}
            chatSending={chatState.chatSending}
            chatMessages={chatState.chatMessages}
            onSendChat={() => void chatState.handleSendChat()}
            lastAssistantText={chatState.lastAssistantText}
            lastTaskGroupId={chatState.lastTaskGroupIdRef.current}
          />
        ) : null}

        {step === 3 ? (
          <RepoOnboardingWebhookStep
            t={t}
            enableWebhookChoice={enableWebhookChoice}
            setEnableWebhookChoice={setEnableWebhookChoice}
            webhookUrl={webhookUrl}
            webhookSecret={webhookSecret}
            webhookVerified={webhookVerified}
            webhookIsLocal={webhookIsLocal}
            onOpenWebhookIntro={onOpenWebhookIntro}
            onRefreshRepo={onRefreshRepo}
          />
        ) : null}

        {step === 4 ? <RepoOnboardingDoneStep t={t} onFinish={onFinish} /> : null}

        <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
          <Button disabled={step === 0} onClick={() => setStep((v) => Math.max(0, v - 1))}>
            {t('common.prev')}
          </Button>
          {step < 4 ? (
            <Button type="primary" disabled={nextDisabled} onClick={() => setStep((v) => Math.min(4, v + 1))}>
              {t('common.next')}
            </Button>
          ) : null}
        </Space>
      </Space>
    </Card>
  );
};

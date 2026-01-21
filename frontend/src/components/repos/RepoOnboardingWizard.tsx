import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Input, Radio, Select, Skeleton, Space, Steps, Tag, Typography } from 'antd';
import { ArrowRightOutlined, CheckOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import type { RepoProviderVisibility, RepoRobot, RepoScopedCredentialsPublic, Repository, UserModelCredentialsPublic } from '../../api';
import { executeChat, fetchRepoProviderMeta, fetchTask, type RepoProvider, type Task } from '../../api';
import { useT } from '../../i18n';
import { buildTaskGroupHash } from '../../router';
import { extractTaskResultText, isTerminalStatus } from '../../utils/task';
import { isLocalhostUrl } from '../../utils/url';
import { MarkdownViewer } from '../MarkdownViewer';
import { pickRepoProviderCredentials, type RepoProviderCredentialSource } from './repoProviderCredentials';

// RepoOnboardingWizard renders the first-entry setup flow (credentials → robot → chat test → webhook). 58w1q3n5nr58flmempxe

type CredentialSource = RepoProviderCredentialSource; // Keep onboarding credential source aligned with shared selectors. kzxac35mxk0fg358i7zs

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'pending' | 'done' | 'error';
  taskId?: string;
};

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

const visibilityTag = (t: (key: string, vars?: any) => string, visibility: RepoProviderVisibility) => {
  if (visibility === 'public') return <Tag color="green">{t('repos.onboarding.visibility.public')}</Tag>;
  if (visibility === 'internal') return <Tag color="geekblue">{t('repos.onboarding.visibility.internal')}</Tag>;
  if (visibility === 'private') return <Tag color="volcano">{t('repos.onboarding.visibility.private')}</Tag>;
  return <Tag>{t('repos.onboarding.visibility.unknown')}</Tag>;
};

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

  const [credentialSource, setCredentialSource] = useState<CredentialSource>('anonymous'); // Default to anonymous so public repos can be detected without any credentials. 58w1q3n5nr58flmempxe
  const [credentialProfileId, setCredentialProfileId] = useState<string>('');

  const [visibility, setVisibility] = useState<RepoProviderVisibility>('unknown');
  const [visibilityUrl, setVisibilityUrl] = useState<string>('');
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string>('');
  const autoDetectVisibilityRef = useRef(false); // Ensure onboarding triggers visibility detection only once on first entry. 58w1q3n5nr58flmempxe

  const enabledRobots = useMemo(() => (robots ?? []).filter((r) => Boolean(r?.enabled)), [robots]);
  const robotOptions = useMemo(
    () => enabledRobots.map((r) => ({ value: r.id, label: r.name || r.id })),
    [enabledRobots]
  );

  const repoProviderCreds = useMemo(
    () => pickRepoProviderCredentials(repo.provider, credentialSource, repoScopedCredentials, userModelCredentials),
    [credentialSource, repo.provider, repoScopedCredentials, userModelCredentials]
  );
  const profileOptions = useMemo(
    () =>
      (repoProviderCreds?.profiles ?? []).map((p) => ({
        value: p.id,
        label: p.remark ? `${p.remark}${p.hasToken ? '' : ` · ${t('common.notConfigured')}`}` : p.id
      })),
    [repoProviderCreds?.profiles, t]
  );

  useEffect(() => {
    // Reset the selected profile when switching credential sources to avoid sending stale ids. 58w1q3n5nr58flmempxe
    setCredentialProfileId('');
  }, [credentialSource]);

  const canDetectVisibility = useMemo(() => {
    if (credentialSource === 'anonymous') return true;
    if (!repoProviderCreds) return false;
    if (!(repoProviderCreds.profiles ?? []).length) return false;
    return true;
  }, [credentialSource, repoProviderCreds]);

  const handleDetectVisibility = useCallback(async () => {
    setVisibilityLoading(true);
    setVisibilityError('');
    try {
      const res = await fetchRepoProviderMeta(repo.id, {
        credentialSource,
        credentialProfileId: credentialProfileId || undefined
      });
      setVisibility(res.visibility || 'unknown');
      setVisibilityUrl(res.webUrl || '');
    } catch (err: any) {
      const code = String(err?.response?.data?.code ?? '').trim();
      if (code === 'REPO_PROVIDER_TOKEN_REQUIRED') {
        setVisibility('unknown');
        setVisibilityUrl('');
        setVisibilityError(t('repos.onboarding.visibility.tokenRequired'));
      } else {
        setVisibility('unknown');
        setVisibilityUrl('');
        setVisibilityError(t('repos.onboarding.visibility.fetchFailed'));
      }
    } finally {
      setVisibilityLoading(false);
    }
  }, [credentialProfileId, credentialSource, repo.id, t]);

  useEffect(() => {
    if (step !== 0) return;
    if (!canDetectVisibility) return;
    if (autoDetectVisibilityRef.current) return;
    autoDetectVisibilityRef.current = true;
    // Auto-detect visibility on the first onboarding entry so users see public/private hints immediately. 58w1q3n5nr58flmempxe
    void handleDetectVisibility();
  }, [canDetectVisibility, handleDetectVisibility, step]);

  const visibilityHint = useMemo(() => {
    if (visibility === 'private' || visibility === 'internal') return t('repos.onboarding.visibility.hintPrivate');
    if (visibility === 'public') return t('repos.onboarding.visibility.hintPublic');
    return t('repos.onboarding.visibility.hintUnknown');
  }, [t, visibility]);

  const [chatRobotId, setChatRobotId] = useState('');
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const lastTaskGroupIdRef = useRef<string>(''); // Store the last chat taskGroupId so the wizard can deep-link to the full timeline. 58w1q3n5nr58flmempxe
  const pollTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (!pollTimerRef.current) return;
    window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  const updateAssistantFromTask = useCallback(
    (task: Task) => {
      const taskId = task.id;
      const terminal = isTerminalStatus(task.status);
      const resultText = extractTaskResultText(task) || '';

      setChatMessages((prev) =>
        prev.map((m) => {
          if (m.taskId !== taskId || m.role !== 'assistant') return m;
          if (!terminal) return { ...m, status: 'pending', text: t('repos.onboarding.chat.pending') };
          if (task.status === 'success') {
            return { ...m, status: 'done', text: resultText || t('repos.onboarding.chat.resultEmpty') };
          }
          return { ...m, status: 'error', text: resultText || t('repos.onboarding.chat.failed') };
        })
      );
    },
    [t]
  );

  const pollTaskUntilTerminal = useCallback(
    (taskId: string) => {
      stopPolling();
      pollTimerRef.current = window.setInterval(async () => {
        try {
          const detail = await fetchTask(taskId);
          updateAssistantFromTask(detail);
          if (isTerminalStatus(detail.status)) stopPolling();
        } catch {
          // Keep polling: transient fetch errors should not break the onboarding chat test UX. 58w1q3n5nr58flmempxe
        }
      }, 2000);
    },
    [stopPolling, updateAssistantFromTask]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  useEffect(() => {
    // Keep robot selection valid when robot list changes. 58w1q3n5nr58flmempxe
    if (!robotOptions.length) {
      setChatRobotId('');
      return;
    }
    setChatRobotId((prev) => (prev && robotOptions.some((o) => o.value === prev) ? prev : robotOptions[0]?.value ?? ''));
  }, [robotOptions]);

  const handleSendChat = useCallback(async () => {
    if (!chatRobotId || chatSending) return;
    const text = chatDraft.trim();
    if (!text) return;
    setChatSending(true);
    try {
      const res = await executeChat({ repoId: repo.id, robotId: chatRobotId, text });
      const taskId = res.task.id;
      lastTaskGroupIdRef.current = res.taskGroup.id;

      setChatDraft('');
      setChatMessages((prev) => [
        ...prev,
        { id: `u_${taskId}`, role: 'user', text, status: 'done' },
        { id: `a_${taskId}`, role: 'assistant', text: t('repos.onboarding.chat.pending'), status: 'pending', taskId }
      ]);

      pollTaskUntilTerminal(taskId);
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        { id: `u_${Date.now()}`, role: 'user', text, status: 'done' },
        { id: `a_${Date.now()}`, role: 'assistant', text: t('repos.onboarding.chat.failed'), status: 'error' }
      ]);
    } finally {
      setChatSending(false);
    }
  }, [chatDraft, chatRobotId, chatSending, pollTaskUntilTerminal, repo.id, t]);

  const lastAssistantText = useMemo(() => {
    const last = [...chatMessages].reverse().find((m) => m.role === 'assistant');
    return last?.text ?? '';
  }, [chatMessages]);

  const [enableWebhookChoice, setEnableWebhookChoice] = useState<'yes' | 'no'>('yes');
  const webhookVerified = Boolean(webhookVerifiedAt);
  const webhookIsLocal = isLocalhostUrl(webhookUrl);

  const nextDisabled = useMemo(() => {
    // Require webhook verification only when the user explicitly opts into enabling webhooks. 58w1q3n5nr58flmempxe
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
                    onClick={handleDetectVisibility}
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
        ) : null}

        {step === 1 ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{t('repos.onboarding.bot.desc')}</Typography.Paragraph>
            <Alert type="info" showIcon message={t('repos.onboarding.bot.tip')} />
            <Space size={10} wrap>
              <Button type="primary" icon={<ArrowRightOutlined />} onClick={onOpenCreateRobot}>
                {t('repos.onboarding.bot.create')}
              </Button>
              <Typography.Text type="secondary">{t('repos.onboarding.bot.count', { count: robots.length })}</Typography.Text>
            </Space>
          </Space>
        ) : null}

        {step === 2 ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{t('repos.onboarding.chat.desc')}</Typography.Paragraph>

            {!robotOptions.length ? (
              <Alert type="warning" showIcon message={t('repos.onboarding.chat.noRobots')} />
            ) : (
              <Card size="small" className="hc-card" title={t('repos.onboarding.chat.cardTitle')}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Select
                    value={chatRobotId || undefined}
                    onChange={(value) => setChatRobotId(String(value ?? ''))}
                    options={robotOptions}
                    placeholder={t('repos.onboarding.chat.robotPlaceholder')}
                  />

                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      value={chatDraft}
                      onChange={(e) => setChatDraft(e.target.value)}
                      placeholder={t('repos.onboarding.chat.inputPlaceholder')}
                      onPressEnter={() => void handleSendChat()}
                      disabled={chatSending}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={chatSending}
                      onClick={() => void handleSendChat()}
                      disabled={!chatRobotId}
                    >
                      {t('repos.onboarding.chat.send')}
                    </Button>
                  </Space.Compact>

                  <div>
                    {chatMessages.length ? (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        {chatMessages.slice(-6).map((m) => (
                          <div key={m.id} className="hc-chat-item">
                            <div className={m.role === 'user' ? 'hc-chat-item__user' : 'hc-chat-item__assistant'}>
                              <div className={`hc-chat-bubble${m.role === 'user' ? ' hc-chat-bubble--user' : ''}`}>{m.text}</div>
                            </div>
                          </div>
                        ))}
                      </Space>
                    ) : (
                      <Typography.Text type="secondary">{t('repos.onboarding.chat.empty')}</Typography.Text>
                    )}
                  </div>

                  {lastAssistantText ? (
                    <Card size="small" className="hc-card" title={t('repos.onboarding.chat.resultTitle')}>
                      <MarkdownViewer markdown={lastAssistantText} />
                    </Card>
                  ) : null}

                  {lastTaskGroupIdRef.current ? (
                    <Button
                      type="link"
                      onClick={() => {
                        // Navigate to the full chat timeline for the last test run. 58w1q3n5nr58flmempxe
                        window.location.hash = buildTaskGroupHash(lastTaskGroupIdRef.current);
                      }}
                    >
                      {t('repos.onboarding.chat.openFullChat')}
                    </Button>
                  ) : null}
                </Space>
              </Card>
            )}
          </Space>
        ) : null}

        {step === 3 ? (
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
                      {t('repos.onboarding.webhook.status')}：{' '}
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
        ) : null}

        {step === 4 ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert type="success" showIcon message={t('repos.onboarding.done.title')} description={t('repos.onboarding.done.desc')} />
            <Button type="primary" icon={<CheckOutlined />} onClick={onFinish}>
              {t('repos.onboarding.done.enter')}
            </Button>
          </Space>
        ) : null}

        <Space style={{ justifyContent: 'space-between', width: '100%' }} wrap>
          <Button disabled={step === 0} onClick={() => setStep((v) => Math.max(0, v - 1))}>
            {t('common.prev')}
          </Button>
          {step < 4 ? (
            <Button
              type="primary"
              disabled={nextDisabled}
              onClick={() => setStep((v) => Math.min(4, v + 1))}
            >
              {t('common.next')}
            </Button>
          ) : null}
        </Space>
      </Space>
    </Card>
  );
};

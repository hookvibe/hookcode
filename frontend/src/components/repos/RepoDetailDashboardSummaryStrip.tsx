import { FC, KeyboardEvent, useMemo } from 'react';
import { ApiOutlined, BranchesOutlined, CodeOutlined, KeyOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Space, Tag, Typography } from 'antd';
import type { RepoAutomationConfig, RepoRobot, RepoScopedCredentialsPublic, Repository } from '../../api';
import { useT } from '../../i18n';
import { normalizeAutomationConfig } from '../repoAutomation/utils';

export type RepoDetailSectionKey = 'basic' | 'branches' | 'credentials' | 'robots' | 'automation' | 'webhooks';

export interface RepoDetailDashboardSummaryStripProps {
  repo: Repository;
  robots: RepoRobot[];
  automationConfig: RepoAutomationConfig | null;
  repoScopedCredentials: RepoScopedCredentialsPublic | null;
  webhookVerified: boolean;
  webhookUrl: string;
  formatTime: (iso: string) => string;
  providerLabel: (provider: string) => string;
  onJumpToSection?: (key: RepoDetailSectionKey) => void;
}

const safeStr = (value: unknown): string => String(value ?? '').trim();

export const RepoDetailDashboardSummaryStrip: FC<RepoDetailDashboardSummaryStripProps> = ({
  repo,
  robots,
  automationConfig,
  repoScopedCredentials,
  webhookVerified,
  webhookUrl,
  formatTime,
  providerLabel,
  onJumpToSection
}) => {
  const t = useT();

  const branches = Array.isArray(repo.branches) ? repo.branches : [];
  const defaultBranch = safeStr(branches.find((b) => b.isDefault)?.name || branches[0]?.name);

  const robotsTotal = robots.length;
  const robotsEnabled = robots.filter((r) => r.enabled).length;
  const defaultRobotName = safeStr(robots.find((r) => r.isDefault)?.name);

  const automationStats = useMemo(() => {
    const config = normalizeAutomationConfig(automationConfig);
    const events = Object.values(config.events ?? {});
    const enabledEvents = events.filter((e) => e.enabled).length;
    const rules = events.reduce((sum, e) => sum + (Array.isArray(e.rules) ? e.rules.length : 0), 0);
    return { enabledEvents, totalEvents: events.length, rules };
  }, [automationConfig]);

  const credentialStats = useMemo(() => {
    const repoProviderProfiles = repoScopedCredentials?.repoProvider?.profiles ?? [];
    const repoProviderConfigured = repoProviderProfiles.filter((p) => Boolean((p as any)?.hasToken)).length;
    const modelProvider = (repoScopedCredentials as any)?.modelProvider ?? {};
    const modelProviders = ['codex', 'claude_code', 'gemini_cli'] as const;
    const modelProfiles = modelProviders.flatMap((k) => (modelProvider?.[k]?.profiles ?? []) as any[]);
    const modelConfigured = modelProfiles.filter((p) => Boolean((p as any)?.hasApiKey)).length;
    return {
      repoProviderConfigured,
      repoProviderTotal: repoProviderProfiles.length,
      modelConfigured,
      modelTotal: modelProfiles.length
    };
  }, [repoScopedCredentials]);

  const canJump = Boolean(onJumpToSection);

  const onKeyActivate = (key: RepoDetailSectionKey) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (!onJumpToSection) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onJumpToSection(key);
  };

  const cardProps = (key: RepoDetailSectionKey) =>
    canJump
      ? {
          role: 'button' as const,
          tabIndex: 0,
          onClick: () => onJumpToSection?.(key),
          onKeyDown: onKeyActivate(key),
          className: 'hc-task-meta__card hc-repo-summary-strip__card hc-repo-summary-strip__card--interactive'
        }
      : { className: 'hc-task-meta__card hc-repo-summary-strip__card' };

  return (
    <div className="hc-repo-summary-strip">
      {/* Present repo modules as a KPI-style summary strip to support the new dashboard layout. u55e45ffi8jng44erdzp */}
      <div className="hc-repo-summary-strip__scroller">
        <div {...cardProps('basic')}>
          <Space size={12} align="start">
            <div className="hc-task-meta__icon" aria-hidden>
              <CodeOutlined style={{ fontSize: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" className="hc-task-meta__label">
                {t('repos.detail.basicTitle')}
              </Typography.Text>
              <div className="hc-task-meta__value">
                <Space size={8} wrap>
                  <Tag color={repo.provider === 'github' ? 'geekblue' : 'orange'}>{providerLabel(repo.provider)}</Tag>
                  <Typography.Text strong className="table-cell-ellipsis" title={repo.name}>
                    {repo.name}
                  </Typography.Text>
                </Space>
                <Space size={8} wrap style={{ marginTop: 6 }}>
                  {repo.enabled ? <Tag color="green">{t('common.enabled')}</Tag> : <Tag color="red">{t('common.disabled')}</Tag>}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {repo.updatedAt ? t('repos.detail.updatedAt', { time: formatTime(repo.updatedAt) }) : '-'}
                  </Typography.Text>
                </Space>
              </div>
            </div>
          </Space>
        </div>

        <div {...cardProps('credentials')}>
          <Space size={12} align="start">
            <div className="hc-task-meta__icon" aria-hidden>
              <KeyOutlined style={{ fontSize: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" className="hc-task-meta__label">
                {t('repos.detail.credentialsTitle')}
              </Typography.Text>
              <div className="hc-task-meta__value">
                <Space direction="vertical" size={2} style={{ width: '100%' }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('repos.detail.credentials.repoProvider')}
                  </Typography.Text>
                  <Typography.Text>
                    {credentialStats.repoProviderConfigured}/{credentialStats.repoProviderTotal}{' '}
                    <Typography.Text type="secondary">{t('common.configured')}</Typography.Text>
                  </Typography.Text>

                  <Typography.Text type="secondary" style={{ fontSize: 12, marginTop: 6 }}>
                    {t('repos.detail.credentials.modelProvider')}
                  </Typography.Text>
                  <Typography.Text>
                    {credentialStats.modelConfigured}/{credentialStats.modelTotal}{' '}
                    <Typography.Text type="secondary">{t('common.configured')}</Typography.Text>
                  </Typography.Text>
                </Space>
              </div>
            </div>
          </Space>
        </div>

        <div {...cardProps('robots')}>
          <Space size={12} align="start">
            <div className="hc-task-meta__icon" aria-hidden>
              <RobotOutlined style={{ fontSize: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" className="hc-task-meta__label">
                {t('repos.robots.title')}
              </Typography.Text>
              <div className="hc-task-meta__value">
                <Space size={8} wrap>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {robotsEnabled}/{robotsTotal}
                  </Typography.Text>
                  <Typography.Text type="secondary">{t('common.enabled')}</Typography.Text>
                </Space>
                <div style={{ marginTop: 6 }}>
                  {defaultRobotName ? (
                    <Space size={6} wrap>
                      <Tag color="blue">{t('repos.detail.robot.default')}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }} className="table-cell-ellipsis" title={defaultRobotName}>
                        {defaultRobotName}
                      </Typography.Text>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      -
                    </Typography.Text>
                  )}
                </div>
              </div>
            </div>
          </Space>
        </div>

        <div {...cardProps('automation')}>
          <Space size={12} align="start">
            <div className="hc-task-meta__icon" aria-hidden>
              <ThunderboltOutlined style={{ fontSize: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" className="hc-task-meta__label">
                {t('repos.automation.title')}
              </Typography.Text>
              <div className="hc-task-meta__value">
                <Space size={10} wrap>
                  <Typography.Text strong style={{ fontSize: 18 }}>
                    {automationStats.rules}
                  </Typography.Text>
                  <Typography.Text type="secondary">{t('repos.dashboard.kpi.rules')}</Typography.Text>
                </Space>
                <Typography.Text type="secondary" style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
                  {t('repos.dashboard.kpi.eventsEnabled', {
                    enabled: automationStats.enabledEvents,
                    total: automationStats.totalEvents
                  })}
                </Typography.Text>
              </div>
            </div>
          </Space>
        </div>

        <div {...cardProps('branches')}>
          <Space size={12} align="start">
            <div className="hc-task-meta__icon" aria-hidden>
              <BranchesOutlined style={{ fontSize: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" className="hc-task-meta__label">
                {t('repos.branches.title')}
              </Typography.Text>
              <div className="hc-task-meta__value">
                <Typography.Text strong style={{ fontSize: 18 }}>
                  {branches.length}
                </Typography.Text>
                <div style={{ marginTop: 6 }}>
                  {defaultBranch ? (
                    <Space size={6} wrap>
                      <Tag color="blue">{t('repos.branches.column.default')}</Tag>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }} className="table-cell-ellipsis" title={defaultBranch}>
                        {defaultBranch}
                      </Typography.Text>
                    </Space>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      -
                    </Typography.Text>
                  )}
                </div>
              </div>
            </div>
          </Space>
        </div>

        <div {...cardProps('webhooks')}>
          <Space size={12} align="start">
            <div className="hc-task-meta__icon" aria-hidden>
              <ApiOutlined style={{ fontSize: 16 }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <Typography.Text type="secondary" className="hc-task-meta__label">
                {t('repos.detail.webhookTitle')}
              </Typography.Text>
              <div className="hc-task-meta__value">
                <Space size={8} wrap>
                  {webhookVerified ? <Tag color="green">{t('repos.webhookIntro.verifiedYes')}</Tag> : <Tag color="gold">{t('repos.webhookIntro.verifiedNo')}</Tag>}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {t('repos.webhookIntro.verified')}
                  </Typography.Text>
                </Space>
                <div style={{ marginTop: 6 }}>
                  {webhookUrl ? (
                    <Typography.Text code ellipsis={{ tooltip: webhookUrl }} copyable={{ text: webhookUrl }} style={{ fontSize: 12 }}>
                      {webhookUrl}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      -
                    </Typography.Text>
                  )}
                </div>
              </div>
            </div>
          </Space>
        </div>
      </div>
    </div>
  );
};

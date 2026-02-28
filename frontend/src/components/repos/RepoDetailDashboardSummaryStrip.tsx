// Modernized repo overview summary strip with hero-number metric tiles. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301
import { FC, KeyboardEvent, useMemo } from 'react';
import { ApiOutlined, BranchesOutlined, CodeOutlined, GlobalOutlined, KeyOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { Tag } from 'antd';
import type { RepoAutomationConfig, RepoRobot, RepoScopedCredentialsPublic, Repository } from '../../api';
import { useT } from '../../i18n';
import { normalizeAutomationConfig } from '../repoAutomation/utils';
import { getRobotProviderLabel } from '../../utils/robot';

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
  const defaultRobot = useMemo(() => robots.find((r) => r.isDefault), [robots]);
  // Resolve the default robot's provider label for compact summary display. docs/en/developer/plans/rbtaidisplay20260128/task_plan.md rbtaidisplay20260128
  const defaultRobotName = safeStr(defaultRobot?.name);
  const defaultRobotProvider = getRobotProviderLabel(defaultRobot?.modelProvider);

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
          className: 'hc-summary-tile hc-summary-tile--interactive'
        }
      : { className: 'hc-summary-tile' };

  return (
    <div className="hc-repo-summary-strip">
      {/* Uniform 3×2 stat tiles — same structure per card to ensure consistent sizing. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 */}
      <div className="hc-repo-summary-strip__scroller">
        {/* ---- Basic ---- */}
        <div {...cardProps('basic')}>
          <div className="hc-summary-tile__icon hc-summary-tile__icon--blue">
            <CodeOutlined />
          </div>
          <div className="hc-summary-tile__body">
            <span className="hc-summary-tile__label">{t('repos.detail.basicTitle')}</span>
            <span className="hc-summary-tile__hero" title={repo.name}>{repo.name}</span>
            <div className="hc-summary-tile__meta">
              <Tag color={repo.provider === 'github' ? 'geekblue' : 'orange'} style={{ marginInlineEnd: 0 }}>{providerLabel(repo.provider)}</Tag>
              {repo.enabled
                ? <span className="hc-summary-tile__badge hc-summary-tile__badge--green">{t('common.enabled')}</span>
                : <span className="hc-summary-tile__badge hc-summary-tile__badge--red">{t('common.disabled')}</span>}
            </div>
          </div>
        </div>

        {/* ---- Branches ---- */}
        <div {...cardProps('branches')}>
          <div className="hc-summary-tile__icon hc-summary-tile__icon--purple">
            <BranchesOutlined />
          </div>
          <div className="hc-summary-tile__body">
            <span className="hc-summary-tile__label">{t('repos.branches.title')}</span>
            <span className="hc-summary-tile__hero">{branches.length}</span>
            <div className="hc-summary-tile__meta">
              {defaultBranch
                ? <><span className="hc-summary-tile__badge hc-summary-tile__badge--blue">{t('repos.branches.column.default')}</span><span className="hc-summary-tile__detail">{defaultBranch}</span></>
                : <span className="hc-summary-tile__muted">-</span>}
            </div>
          </div>
        </div>

        {/* ---- Credentials ---- */}
        {/* Credentials tile — compact stat pills to avoid label overflow. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 */}
        <div {...cardProps('credentials')}>
          <div className="hc-summary-tile__icon hc-summary-tile__icon--amber">
            <KeyOutlined />
          </div>
          <div className="hc-summary-tile__body">
            <span className="hc-summary-tile__label">{t('repos.detail.credentialsTitle')}</span>
            <span className="hc-summary-tile__hero">
              {credentialStats.repoProviderConfigured + credentialStats.modelConfigured}
              <span className="hc-summary-tile__hero-sub"> / {credentialStats.repoProviderTotal + credentialStats.modelTotal}</span>
            </span>
            <div className="hc-summary-tile__meta">
              <span className="hc-summary-tile__pill"><GlobalOutlined style={{ fontSize: 11 }} />{credentialStats.repoProviderConfigured}/{credentialStats.repoProviderTotal}</span>
              <span className="hc-summary-tile__pill"><KeyOutlined style={{ fontSize: 11 }} />{credentialStats.modelConfigured}/{credentialStats.modelTotal}</span>
            </div>
          </div>
        </div>

        {/* ---- Robots ---- */}
        <div {...cardProps('robots')}>
          <div className="hc-summary-tile__icon hc-summary-tile__icon--teal">
            <RobotOutlined />
          </div>
          <div className="hc-summary-tile__body">
            <span className="hc-summary-tile__label">{t('repos.robots.title')}</span>
            <span className="hc-summary-tile__hero">
              {robotsEnabled}<span className="hc-summary-tile__hero-sub"> / {robotsTotal}</span>
            </span>
            <div className="hc-summary-tile__meta">
              {defaultRobotName
                ? <><span className="hc-summary-tile__badge hc-summary-tile__badge--blue">{t('repos.detail.robot.default')}</span><span className="hc-summary-tile__detail">{defaultRobotName}{defaultRobotProvider ? ` (${defaultRobotProvider})` : ''}</span></>
                : <span className="hc-summary-tile__muted">-</span>}
            </div>
          </div>
        </div>

        {/* ---- Automation ---- */}
        <div {...cardProps('automation')}>
          <div className="hc-summary-tile__icon hc-summary-tile__icon--orange">
            <ThunderboltOutlined />
          </div>
          <div className="hc-summary-tile__body">
            <span className="hc-summary-tile__label">{t('repos.automation.title')}</span>
            <span className="hc-summary-tile__hero">{automationStats.rules}</span>
            <div className="hc-summary-tile__meta">
              <span className="hc-summary-tile__detail">
                {t('repos.dashboard.kpi.eventsEnabled', { enabled: automationStats.enabledEvents, total: automationStats.totalEvents })}
              </span>
            </div>
          </div>
        </div>

        {/* ---- Webhooks ---- */}
        {/* Webhooks tile — show hostname only to avoid URL overflow. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 */}
        <div {...cardProps('webhooks')}>
          <div className="hc-summary-tile__icon hc-summary-tile__icon--green">
            <ApiOutlined />
          </div>
          <div className="hc-summary-tile__body">
            <span className="hc-summary-tile__label">{t('repos.detail.webhookTitle')}</span>
            <span className="hc-summary-tile__hero">
              {webhookVerified
                ? <span className="hc-summary-tile__badge hc-summary-tile__badge--green">{t('repos.webhookIntro.verifiedYes')}</span>
                : <span className="hc-summary-tile__badge hc-summary-tile__badge--gold">{t('repos.webhookIntro.verifiedNo')}</span>}
            </span>
            <div className="hc-summary-tile__meta">
              {webhookUrl
                ? <span className="hc-summary-tile__detail" title={webhookUrl}>{(() => { try { return new URL(webhookUrl).host; } catch { return webhookUrl; } })()}</span>
                : <span className="hc-summary-tile__muted">-</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

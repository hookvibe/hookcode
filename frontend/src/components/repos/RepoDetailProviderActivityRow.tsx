import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Radio, Row, Select, Skeleton, Space, Tooltip, Typography } from 'antd';
// Add Typography/Tooltip imports for activity labels and pagination tips after refactor. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import type {
  RepoProviderActivity,
  RepoProviderVisibility,
  RepoScopedCredentialsPublic,
  Repository,
  UserModelCredentialsPublic
} from '../../api';
import { fetchRepoProviderActivity, fetchRepoProviderMeta } from '../../api';
import { useT } from '../../i18n';
import { pickRepoProviderCredentials, type RepoProviderCredentialSource } from './repoProviderCredentials';
import { renderProviderActivityItem } from './repoProviderActivityRowHelpers';

// Render recent provider activity as compact lists with right-aligned task-group entry and column-scoped pagination. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc

export interface RepoDetailProviderActivityRowProps {
  repo: Repository;
  repoScopedCredentials: RepoScopedCredentialsPublic | null;
  userModelCredentials: UserModelCredentialsPublic | null;
  formatTime: (iso: string) => string;
}


export const RepoDetailProviderActivityRow: FC<RepoDetailProviderActivityRowProps> = ({
  repo,
  repoScopedCredentials,
  userModelCredentials,
  formatTime
}) => {
  const t = useT();

  const [visibility, setVisibility] = useState<RepoProviderVisibility>('unknown');
  const [visibilityLoading, setVisibilityLoading] = useState(true);

  const [credentialSource, setCredentialSource] = useState<RepoProviderCredentialSource>('anonymous');
  const [credentialProfileId, setCredentialProfileId] = useState('');

  const [activity, setActivity] = useState<RepoProviderActivity | null>(null);
  const [activityLoadingByKind, setActivityLoadingByKind] = useState({ commits: false, merges: false, issues: false });
  const [activityError, setActivityError] = useState<string>('');

  const [commitsPage, setCommitsPage] = useState(1);
  const [mergesPage, setMergesPage] = useState(1);
  const [issuesPage, setIssuesPage] = useState(1);
  // Use a larger page size so the activity list fills the dashboard slot better (avoid large empty space). docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
  const pageSize = 10;

  const repoProviderCreds = useMemo(
    () => pickRepoProviderCredentials(repo.provider, credentialSource, repoScopedCredentials, userModelCredentials),
    [credentialSource, repo.provider, repoScopedCredentials, userModelCredentials]
  );

  const profileOptions = useMemo(
    () =>
      (repoProviderCreds?.profiles ?? []).map((p: any) => ({
        value: p.id,
        disabled: !p.hasToken,
        label: p.remark ? `${p.remark}${p.hasToken ? '' : ` · ${t('common.notConfigured')}`}` : p.id
      })),
    [repoProviderCreds?.profiles, t]
  );

  useEffect(() => {
    // Reset selected profile when switching credential sources to avoid sending stale ids. kzxac35mxk0fg358i7zs
    setCredentialProfileId('');
    setCommitsPage(1);
    setMergesPage(1);
    setIssuesPage(1);
    // Clear existing activity so page labels cannot drift from the displayed data. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
    setActivity(null);
  }, [credentialSource]);

  const resolveActivityError = useCallback(
    (err: any): string => {
      const code = String(err?.response?.data?.code ?? '').trim();
      if (code === 'REPO_PROVIDER_TOKEN_REQUIRED') return t('repos.detail.providerActivity.tokenRequired');
      if (code === 'REPO_PROVIDER_AUTH_REQUIRED') return t('repos.detail.providerActivity.authRequired');
      return t('repos.detail.providerActivity.fetchFailed');
    },
    [t]
  );

  const loadActivityAll = useCallback(
    async (params: { source: RepoProviderCredentialSource; profileId?: string; commitsPage: number; mergesPage: number; issuesPage: number }) => {
      // Keep refresh behavior intact while allowing pagination to be column-scoped. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
      setActivityLoadingByKind({ commits: true, merges: true, issues: true });
      setActivityError('');
      try {
        const res = await fetchRepoProviderActivity(repo.id, {
          credentialSource: params.source,
          credentialProfileId: params.profileId || undefined,
          pageSize,
          commitsPage: params.commitsPage,
          mergesPage: params.mergesPage,
          issuesPage: params.issuesPage
        });
        setActivity(res);
      } catch (err: any) {
        setActivityError(resolveActivityError(err));
        setActivity(null);
      } finally {
        setActivityLoadingByKind({ commits: false, merges: false, issues: false });
      }
    },
    [pageSize, repo.id, resolveActivityError]
  );

  const loadActivityColumn = useCallback(
    async (
      kind: 'commits' | 'merges' | 'issues',
      params: { source: RepoProviderCredentialSource; profileId?: string; commitsPage: number; mergesPage: number; issuesPage: number }
    ) => {
      // Prevent other columns from reloading/skeletoning when paging one list. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
      setActivityLoadingByKind((prev) => ({ ...prev, [kind]: true }));
      setActivityError('');
      try {
        const res = await fetchRepoProviderActivity(repo.id, {
          credentialSource: params.source,
          credentialProfileId: params.profileId || undefined,
          pageSize,
          commitsPage: params.commitsPage,
          mergesPage: params.mergesPage,
          issuesPage: params.issuesPage
        });
        setActivity((prev) => (prev ? { ...prev, [kind]: res[kind] } : res));
        return true;
      } catch (err: any) {
        setActivityError(resolveActivityError(err));
        return false;
      } finally {
        setActivityLoadingByKind((prev) => ({ ...prev, [kind]: false }));
      }
    },
    [pageSize, repo.id, resolveActivityError]
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setVisibilityLoading(true);
      setActivity(null);
      setActivityError('');
      try {
        const meta = await fetchRepoProviderMeta(repo.id, { credentialSource: 'anonymous' });
        if (cancelled) return;
        setVisibility(meta.visibility || 'unknown');
        if (meta.visibility === 'public') {
          setCredentialSource('anonymous');
          await loadActivityAll({ source: 'anonymous', commitsPage: 1, mergesPage: 1, issuesPage: 1 });
        } else {
          setCredentialSource('user');
        }
      } catch {
        if (cancelled) return;
        setVisibility('unknown');
        setCredentialSource('user');
      } finally {
        if (cancelled) return;
        setVisibilityLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [loadActivityAll, repo.id]);

  const showCredentialPicker = !visibilityLoading && visibility !== 'public';

  const commits = activity?.commits?.items ?? [];
  const merges = activity?.merges?.items ?? [];
  const issues = activity?.issues?.items ?? [];

  const column = useCallback(
    (
      label: string,
      kind: 'commit' | 'merge' | 'issue',
      items: RepoProviderActivityItem[],
      page: number,
      hasMore: boolean,
      loading: boolean,
      onChangePage: (next: number) => void
    ) => {
      const content = (() => {
        if (visibilityLoading || loading) {
          return <Skeleton active title={false} paragraph={{ rows: 2 }} />;
        }
        if (!items.length) {
          return (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('repos.detail.providerActivity.empty')}
            </Typography.Text>
          );
        }
        return (
          <div className="hc-provider-activity-list">
            {/* Use a plain list container to keep borders/ellipsis stable across AntD wrappers. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc */}
            {items.map((item) => renderProviderActivityItem(t, formatTime, kind, item))}
          </div>
        );
      })();

      return (
        <div style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Typography.Text>
          <div style={{ marginTop: 6 }}>{content}</div>
          {!visibilityLoading && (page > 1 || hasMore) ? (
            <div className="hc-provider-activity-pagination">
              {/* Center icon pagination to keep controls minimal and prevent overflow. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc */}
              <Tooltip title={t('common.prev')}>
                <Button
                  size="small"
                  type="text"
                  icon={<LeftOutlined />}
                  aria-label={t('common.prev')}
                  onClick={() => onChangePage(page - 1)}
                  disabled={page <= 1 || loading}
                />
              </Tooltip>

              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('repos.detail.providerActivity.page', { page })}
              </Typography.Text>

              <Tooltip title={t('common.next')}>
                <Button
                  size="small"
                  type="text"
                  icon={<RightOutlined />}
                  aria-label={t('common.next')}
                  onClick={() => onChangePage(page + 1)}
                  disabled={!hasMore || loading}
                />
              </Tooltip>
            </div>
          ) : null}
        </div>
      );
    },
    [formatTime, t, visibilityLoading]
  );

  const onRefresh = useCallback(() => {
    void loadActivityAll({
      source: showCredentialPicker ? credentialSource : 'anonymous',
      profileId: showCredentialPicker ? credentialProfileId : undefined,
      commitsPage,
      mergesPage,
      issuesPage
    });
  }, [commitsPage, credentialProfileId, credentialSource, issuesPage, loadActivityAll, mergesPage, showCredentialPicker]);

  return (
    // Make the activity row fill the dashboard slot so dividers can span the full column height. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
    <Card
      size="small"
      title={t('repos.detail.providerActivity.title')}
      className="hc-card hc-provider-activity-card"
      extra={
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={visibilityLoading || activityLoadingByKind.commits || activityLoadingByKind.merges || activityLoadingByKind.issues}
        >
          {t('common.refresh')}
        </Button>
      }
    >
      {activityError ? <Alert style={{ marginBottom: 12 }} type="warning" showIcon message={activityError} /> : null}

      {showCredentialPicker ? (
        <Space size={8} wrap style={{ marginBottom: 12 }}>
          <Typography.Text type="secondary">{t('repos.detail.providerActivity.credentialHint')}</Typography.Text>
          <Radio.Group value={credentialSource} onChange={(e) => setCredentialSource(e.target.value)}>
            <Radio.Button value="user">{t('repos.onboarding.visibility.credentialSource.user')}</Radio.Button>
            <Radio.Button value="repo">{t('repos.onboarding.visibility.credentialSource.repo')}</Radio.Button>
            <Radio.Button value="anonymous">{t('repos.onboarding.visibility.credentialSource.anonymous')}</Radio.Button>
          </Radio.Group>

          {credentialSource !== 'anonymous' ? (
            <Select
              style={{ minWidth: 220 }}
              value={credentialProfileId || undefined}
              options={profileOptions}
              placeholder={t('repos.detail.providerActivity.profilePlaceholder')}
              onChange={(value) => setCredentialProfileId(String(value ?? ''))}
              allowClear
              disabled={!profileOptions.length}
            />
          ) : null}
        </Space>
      ) : null}

      <Row gutter={[16, 12]} className="hc-provider-activity-columns">
        {/* Add visual separation between activity columns for readability. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc */}
        <Col xs={24} md={8}>
          <div className="hc-provider-activity-column">
            {column(
              t('repos.detail.providerActivity.commits'),
              'commit',
              commits,
              commitsPage,
              Boolean(activity?.commits?.hasMore),
              activityLoadingByKind.commits,
              (next) => {
                // Page commits without refreshing other columns to avoid full skeleton flicker. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
                void (async () => {
                  const ok = await loadActivityColumn('commits', {
                    source: showCredentialPicker ? credentialSource : 'anonymous',
                    profileId: showCredentialPicker ? credentialProfileId : undefined,
                    commitsPage: next,
                    mergesPage,
                    issuesPage
                  });
                  if (ok) setCommitsPage(next);
                })();
              }
            )}
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="hc-provider-activity-column hc-provider-activity-column--divider">
            {column(
              t('repos.detail.providerActivity.merges'),
              'merge',
              merges,
              mergesPage,
              Boolean(activity?.merges?.hasMore),
              activityLoadingByKind.merges,
              (next) => {
                // Page merges without refreshing other columns to avoid full skeleton flicker. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
                void (async () => {
                  const ok = await loadActivityColumn('merges', {
                    source: showCredentialPicker ? credentialSource : 'anonymous',
                    profileId: showCredentialPicker ? credentialProfileId : undefined,
                    commitsPage,
                    mergesPage: next,
                    issuesPage
                  });
                  if (ok) setMergesPage(next);
                })();
              }
            )}
          </div>
        </Col>
        <Col xs={24} md={8}>
          <div className="hc-provider-activity-column hc-provider-activity-column--divider">
            {column(
              t('repos.detail.providerActivity.issues'),
              'issue',
              issues,
              issuesPage,
              Boolean(activity?.issues?.hasMore),
              activityLoadingByKind.issues,
              (next) => {
                // Page issues without refreshing other columns to avoid full skeleton flicker. docs/en/developer/plans/4wrx55jmsm8z5fuqlfdc/task_plan.md 4wrx55jmsm8z5fuqlfdc
                void (async () => {
                  const ok = await loadActivityColumn('issues', {
                    source: showCredentialPicker ? credentialSource : 'anonymous',
                    profileId: showCredentialPicker ? credentialProfileId : undefined,
                    commitsPage,
                    mergesPage,
                    issuesPage: next
                  });
                  if (ok) setIssuesPage(next);
                })();
              }
            )}
          </div>
        </Col>
      </Row>
    </Card>
  );
};

import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Radio, Row, Select, Skeleton, Space, Tag, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type {
  RepoProviderActivity,
  RepoProviderActivityItem,
  RepoProviderVisibility,
  RepoScopedCredentialsPublic,
  Repository,
  UserModelCredentialsPublic
} from '../../api';
import { fetchRepoProviderActivity, fetchRepoProviderMeta } from '../../api';
import { useT } from '../../i18n';
import { buildTaskGroupHash, buildTaskHash } from '../../router';
import { pickRepoProviderCredentials, type RepoProviderCredentialSource } from './repoProviderCredentials';

// Render recent provider activity (commits/merges/issues) as a full-width dashboard row with pagination and task bindings. kzxac35mxk0fg358i7zs

export interface RepoDetailProviderActivityRowProps {
  repo: Repository;
  repoScopedCredentials: RepoScopedCredentialsPublic | null;
  userModelCredentials: UserModelCredentialsPublic | null;
  formatTime: (iso: string) => string;
}

const shortIdFallback = (id: string): string => id.slice(0, 7);

const stateTag = (t: (key: string, vars?: any) => string, state?: string) => {
  const raw = String(state ?? '').trim().toLowerCase();
  if (!raw) return null;
  const key =
    raw === 'merged'
      ? 'repos.detail.providerActivity.state.merged'
      : raw === 'open' || raw === 'opened'
        ? 'repos.detail.providerActivity.state.open'
        : raw === 'closed'
          ? 'repos.detail.providerActivity.state.closed'
          : '';
  const label = key ? t(key as any) : raw;
  const color = raw === 'merged' ? 'green' : raw === 'open' || raw === 'opened' ? 'geekblue' : undefined;
  return <Tag color={color}>{label}</Tag>;
};

const renderItem = (t: (key: string, vars?: any) => string, formatTime: (iso: string) => string, kind: 'commit' | 'merge' | 'issue', item: RepoProviderActivityItem) => {
  const label = item.title || item.id;
  const displayId = kind === 'commit' ? String(item.shortId ?? '').trim() || shortIdFallback(item.id) : '';
  const metaTime = item.time ? formatTime(item.time) : '';

  const titleNode = item.url ? (
    <Typography.Link href={item.url} target="_blank" rel="noreferrer" className="table-cell-ellipsis" title={label}>
      {label}
    </Typography.Link>
  ) : (
    <Typography.Text className="table-cell-ellipsis" title={label}>
      {label}
    </Typography.Text>
  );

  const taskGroups = Array.isArray(item.taskGroups) ? item.taskGroups : [];
  const processingTasks = taskGroups.flatMap((g) => (Array.isArray(g.processingTasks) ? g.processingTasks : []));

  return (
    <div key={item.id} style={{ minWidth: 0 }}>
      <Space size={8} wrap style={{ width: '100%' }}>
        {kind === 'commit' ? (
          <Typography.Text code title={item.id} style={{ fontSize: 12 }}>
            {displayId}
          </Typography.Text>
        ) : null}
        {kind !== 'commit' ? stateTag(t, item.state) : null}
        {titleNode}
        {kind !== 'commit' && metaTime ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('repos.detail.providerActivity.updatedAt', { time: metaTime })}
          </Typography.Text>
        ) : null}
      </Space>

      {taskGroups.length ? (
        <Space size={6} wrap style={{ marginTop: 4 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('repos.detail.providerActivity.taskGroups', { count: taskGroups.length })}
          </Typography.Text>
          {taskGroups.slice(0, 2).map((g) => (
            <Button
              key={g.id}
              size="small"
              type="link"
              onClick={() => {
                window.location.hash = buildTaskGroupHash(g.id);
              }}
            >
              {g.title || g.id}
            </Button>
          ))}
          {taskGroups.length > 2 ? (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {t('repos.detail.providerActivity.taskGroups.more', { count: taskGroups.length - 2 })}
            </Typography.Text>
          ) : null}
        </Space>
      ) : null}

      {processingTasks.length ? (
        <Space size={6} wrap style={{ marginTop: 2 }}>
          <Tag color="gold">{t('repos.detail.providerActivity.processing', { count: processingTasks.length })}</Tag>
          {processingTasks.slice(0, 1).map((task) => (
            <Button
              key={task.id}
              size="small"
              type="link"
              onClick={() => {
                window.location.hash = buildTaskHash(task.id);
              }}
            >
              {task.title || task.id}
            </Button>
          ))}
        </Space>
      ) : null}
    </div>
  );
};

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
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string>('');

  const [commitsPage, setCommitsPage] = useState(1);
  const [mergesPage, setMergesPage] = useState(1);
  const [issuesPage, setIssuesPage] = useState(1);
  const pageSize = 5;

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
  }, [credentialSource]);

  const loadActivity = useCallback(
    async (params: { source: RepoProviderCredentialSource; profileId?: string; commitsPage: number; mergesPage: number; issuesPage: number }) => {
      setActivityLoading(true);
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
        const code = String(err?.response?.data?.code ?? '').trim();
        if (code === 'REPO_PROVIDER_TOKEN_REQUIRED') {
          setActivityError(t('repos.detail.providerActivity.tokenRequired'));
        } else if (code === 'REPO_PROVIDER_AUTH_REQUIRED') {
          setActivityError(t('repos.detail.providerActivity.authRequired'));
        } else {
          setActivityError(t('repos.detail.providerActivity.fetchFailed'));
        }
        setActivity(null);
      } finally {
        setActivityLoading(false);
      }
    },
    [pageSize, repo.id, t]
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
          await loadActivity({ source: 'anonymous', commitsPage: 1, mergesPage: 1, issuesPage: 1 });
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
  }, [loadActivity, repo.id]);

  const showCredentialPicker = !visibilityLoading && visibility !== 'public';

  const commits = activity?.commits?.items ?? [];
  const merges = activity?.merges?.items ?? [];
  const issues = activity?.issues?.items ?? [];

  const column = useCallback(
    (label: string, kind: 'commit' | 'merge' | 'issue', items: RepoProviderActivityItem[], page: number, hasMore: boolean, onChangePage: (next: number) => void) => {
      const content = (() => {
        if (visibilityLoading || activityLoading) {
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
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            {items.map((item) => renderItem(t, formatTime, kind, item))}
          </Space>
        );
      })();

      return (
        <div style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Typography.Text>
          <div style={{ marginTop: 6 }}>{content}</div>
          {!visibilityLoading && !activityLoading && (page > 1 || hasMore) ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <Space size={8}>
                <Button size="small" onClick={() => onChangePage(page - 1)} disabled={page <= 1}>
                  {t('common.prev')}
                </Button>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('repos.detail.providerActivity.page', { page })}
                </Typography.Text>
                <Button size="small" onClick={() => onChangePage(page + 1)} disabled={!hasMore}>
                  {t('common.next')}
                </Button>
              </Space>
            </div>
          ) : null}
        </div>
      );
    },
    [activityLoading, formatTime, t, visibilityLoading]
  );

  const onRefresh = useCallback(() => {
    void loadActivity({
      source: showCredentialPicker ? credentialSource : 'anonymous',
      profileId: showCredentialPicker ? credentialProfileId : undefined,
      commitsPage,
      mergesPage,
      issuesPage
    });
  }, [commitsPage, credentialProfileId, credentialSource, issuesPage, loadActivity, mergesPage, showCredentialPicker]);

  return (
    <Card
      size="small"
      title={t('repos.detail.providerActivity.title')}
      className="hc-card"
      extra={
        <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh} loading={visibilityLoading || activityLoading}>
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

      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}>
          {column(
            t('repos.detail.providerActivity.commits'),
            'commit',
            commits,
            commitsPage,
            Boolean(activity?.commits?.hasMore),
            (next) => {
              setCommitsPage(next);
              void loadActivity({
                source: showCredentialPicker ? credentialSource : 'anonymous',
                profileId: showCredentialPicker ? credentialProfileId : undefined,
                commitsPage: next,
                mergesPage,
                issuesPage
              });
            }
          )}
        </Col>
        <Col xs={24} md={8}>
          {column(
            t('repos.detail.providerActivity.merges'),
            'merge',
            merges,
            mergesPage,
            Boolean(activity?.merges?.hasMore),
            (next) => {
              setMergesPage(next);
              void loadActivity({
                source: showCredentialPicker ? credentialSource : 'anonymous',
                profileId: showCredentialPicker ? credentialProfileId : undefined,
                commitsPage,
                mergesPage: next,
                issuesPage
              });
            }
          )}
        </Col>
        <Col xs={24} md={8}>
          {column(
            t('repos.detail.providerActivity.issues'),
            'issue',
            issues,
            issuesPage,
            Boolean(activity?.issues?.hasMore),
            (next) => {
              setIssuesPage(next);
              void loadActivity({
                source: showCredentialPicker ? credentialSource : 'anonymous',
                profileId: showCredentialPicker ? credentialProfileId : undefined,
                commitsPage,
                mergesPage,
                issuesPage: next
              });
            }
          )}
        </Col>
      </Row>
    </Card>
  );
};

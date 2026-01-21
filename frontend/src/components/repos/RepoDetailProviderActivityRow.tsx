import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Col, Radio, Row, Select, Skeleton, Space, Typography } from 'antd';
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
import { pickRepoProviderCredentials, type RepoProviderCredentialSource } from './repoProviderCredentials';

// Render recent provider activity (commits/merges/issues) under the repo Basic card. kzxac35mxk0fg358i7zs

export interface RepoDetailProviderActivityRowProps {
  repo: Repository;
  repoScopedCredentials: RepoScopedCredentialsPublic | null;
  userModelCredentials: UserModelCredentialsPublic | null;
}

const normalizeItems = (items: RepoProviderActivityItem[] | undefined | null): RepoProviderActivityItem[] =>
  Array.isArray(items) ? items : [];

const renderItem = (item: RepoProviderActivityItem) => {
  const label = item.title || item.id;
  if (!item.url) {
    return (
      <Typography.Text key={item.id} className="table-cell-ellipsis" title={label} style={{ display: 'block' }}>
        {label}
      </Typography.Text>
    );
  }
  return (
    <Typography.Link
      key={item.id}
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="table-cell-ellipsis"
      title={label}
      style={{ display: 'block' }}
    >
      {label}
    </Typography.Link>
  );
};

export const RepoDetailProviderActivityRow: FC<RepoDetailProviderActivityRowProps> = ({
  repo,
  repoScopedCredentials,
  userModelCredentials
}) => {
  const t = useT();

  const [visibility, setVisibility] = useState<RepoProviderVisibility>('unknown');
  const [visibilityLoading, setVisibilityLoading] = useState(true);

  const [credentialSource, setCredentialSource] = useState<RepoProviderCredentialSource>('anonymous');
  const [credentialProfileId, setCredentialProfileId] = useState('');

  const [activity, setActivity] = useState<RepoProviderActivity | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string>('');

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
  }, [credentialSource]);

  const loadActivity = useCallback(
    async (params: { source: RepoProviderCredentialSource; profileId?: string }) => {
      setActivityLoading(true);
      setActivityError('');
      try {
        const res = await fetchRepoProviderActivity(repo.id, {
          credentialSource: params.source,
          credentialProfileId: params.profileId || undefined,
          limit: 3
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
    [repo.id, t]
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
          await loadActivity({ source: 'anonymous' });
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

  const commits = normalizeItems(activity?.commits);
  const merges = normalizeItems(activity?.merges);
  const issues = normalizeItems(activity?.issues);

  const column = useCallback(
    (label: string, items: RepoProviderActivityItem[]) => {
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
            {items.slice(0, 3).map(renderItem)}
          </Space>
        );
      })();

      return (
        <div style={{ minWidth: 0 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {label}
          </Typography.Text>
          <div style={{ marginTop: 6 }}>{content}</div>
        </div>
      );
    },
    [activityLoading, t, visibilityLoading]
  );

  const onRefresh = useCallback(() => {
    void loadActivity({
      source: showCredentialPicker ? credentialSource : 'anonymous',
      profileId: showCredentialPicker ? credentialProfileId : undefined
    });
  }, [credentialProfileId, credentialSource, loadActivity, showCredentialPicker]);

  return (
    <div style={{ marginTop: 12 }}>
      <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text type="secondary">{t('repos.detail.providerActivity.title')}</Typography.Text>
        <Button
          size="small"
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={visibilityLoading || activityLoading}
        >
          {t('common.refresh')}
        </Button>
      </Space>

      {activityError ? <Alert style={{ marginTop: 10 }} type="warning" showIcon message={activityError} /> : null}

      {showCredentialPicker ? (
        <Space size={8} wrap style={{ marginTop: 10 }}>
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

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24} md={8}>
          {column(t('repos.detail.providerActivity.commits'), commits)}
        </Col>
        <Col xs={24} md={8}>
          {column(t('repos.detail.providerActivity.merges'), merges)}
        </Col>
        <Col xs={24} md={8}>
          {column(t('repos.detail.providerActivity.issues'), issues)}
        </Col>
      </Row>
    </div>
  );
};

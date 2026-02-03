import { FC, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App, Button, Card, Empty, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { PlusOutlined, SettingOutlined } from '@ant-design/icons';
import type { RepoAutomationConfig, RepoProvider, Repository } from '../api';
import { createRepo, fetchRepo, listRepos } from '../api';
import { useLocale, useT } from '../i18n';
import { buildRepoHash } from '../router';
import { PageNav, type PageNavMenuAction } from '../components/nav/PageNav';
import { CardListSkeleton } from '../components/skeletons/CardListSkeleton';
import { parseRepoUrl } from '../utils/repoUrl';

/**
 * ReposPage:
 * - Business context: manage repositories that HookCode connects to (GitLab/GitHub).
 * - Migration goal: provide a card-first list that matches `frontend-chat` visual style while reusing backend APIs.
 *
 * Key behaviors:
 * - List repositories with search.
 * - Show small meta summary (robots/triggers) by loading repo detail lazily.
 * - Allow creating a repository (minimal fields; webhook secret/path shown after create).
 *
 * Change record:
 * - 2026-01-12: Added as part of migrating repo management into `frontend-chat`.
 */

const providerLabel = (provider: RepoProvider) => (provider === 'github' ? 'GitHub' : 'GitLab');

type RepoSummary =
  | { loading: true }
  | { loading: false; robotsTotal: number; robotsEnabled: number; triggersTotal: number; triggersEnabled: number }
  | { loading: false; error: true };

const summarizeAutomation = (config?: RepoAutomationConfig | null) => {
  // Business intent: provide a quick "trigger count" overview on the list page without rendering the full rules.
  let triggersTotal = 0;
  let triggersEnabled = 0;
  if (!config?.events) return { triggersTotal, triggersEnabled };
  for (const event of Object.values(config.events)) {
    if (!event) continue;
    for (const rule of event.rules || []) {
      triggersTotal += 1;
      if (event.enabled && rule.enabled) triggersEnabled += 1;
    }
  }
  return { triggersTotal, triggersEnabled };
};

export interface ReposPageProps {
  userPanel?: ReactNode;
  navToggle?: PageNavMenuAction;
}

export const ReposPage: FC<ReposPageProps> = ({ userPanel, navToggle }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [repoSummaryById, setRepoSummaryById] = useState<Record<string, RepoSummary>>({});
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<{ provider: RepoProvider; repoUrl: string }>(); // Collect provider + repo URL for repo identity parsing. 58w1q3n5nr58flmempxe

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listRepos();
      setRepos(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.repos.fetchFailed'));
      setRepos([]);
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    // Performance note: fetch repo details lazily to enrich cards with robots/triggers counts.
    let cancelled = false;
    const ids = repos.map((r) => r.id).filter(Boolean);
    if (!ids.length) {
      setRepoSummaryById({});
      return () => {
        cancelled = true;
      };
    }

    setRepoSummaryById((prev) => {
      const next: Record<string, RepoSummary> = {};
      for (const id of ids) next[id] = prev[id] ?? { loading: true };
      return next;
    });

    void (async () => {
      await Promise.all(
        ids.map(async (id) => {
          try {
            const detail = await fetchRepo(id);
            if (cancelled) return;
            const robotsTotal = detail.robots?.length ?? 0;
            const robotsEnabled = (detail.robots ?? []).filter((r) => Boolean(r?.enabled)).length;
            const { triggersTotal, triggersEnabled } = summarizeAutomation(detail.automationConfig);
            setRepoSummaryById((prev) => ({
              ...prev,
              [id]: { loading: false, robotsTotal, robotsEnabled, triggersTotal, triggersEnabled }
            }));
          } catch (err) {
            console.error('[repos] load summary failed', err);
            if (cancelled) return;
            setRepoSummaryById((prev) => ({ ...prev, [id]: { loading: false, error: true } }));
          }
        })
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [repos]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => `${r.name} ${r.id} ${r.provider}`.toLowerCase().includes(q));
  }, [repos, search]);

  const formatTime = useCallback(
    (iso: string): string => {
      try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
      } catch {
        return iso;
      }
    },
    [locale]
  );

  const openRepo = useCallback((repo: Repository) => {
    window.location.hash = buildRepoHash(repo.id);
  }, []);

  const providerOptions = useMemo(
    () => [
      { value: 'gitlab', label: 'GitLab' },
      { value: 'github', label: 'GitHub' }
    ],
    []
  );

  return (
    <div className="hc-page">
      <PageNav
        title={t('repos.page.title')}
        meta={<Typography.Text type="secondary">{t('repos.page.subtitle', { count: filtered.length })}</Typography.Text>}
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            {t('repos.page.create')}
          </Button>
        }
        // Provide the mobile nav toggle so the header can open the sidebar drawer. docs/en/developer/plans/dhbg1plvf7lvamcpt546/task_plan.md dhbg1plvf7lvamcpt546
        navToggle={navToggle}
        userPanel={userPanel}
      />

      <div className="hc-page__body">
        <div className="hc-toolbar">
          <Input allowClear placeholder={t('repos.page.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {filtered.length ? (
          <div className="hc-card-list">
            {/* Switch repo list to a responsive grid with segmented card sections. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
            <div className="hc-card-grid">
              {filtered.map((repo) => {
                const summary = repoSummaryById[repo.id];
                const robotsText =
                  !summary || summary.loading
                    ? '…'
                    : 'error' in summary
                      ? '—'
                      : t('repos.page.meta.robots', { enabled: summary.robotsEnabled, total: summary.robotsTotal });
                const triggersText =
                  !summary || summary.loading
                    ? '…'
                    : 'error' in summary
                      ? '—'
                      : t('repos.page.meta.triggers', { enabled: summary.triggersEnabled, total: summary.triggersTotal });

                return (
                  <Card
                    key={repo.id}
                    size="small"
                    hoverable
                    className="hc-repo-card"
                    // Refresh repo card padding to match the new glassmorphism scale. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
                    styles={{ body: { padding: 14 } }}
                    onClick={() => openRepo(repo)}
                  >
                    {/* Segment repo card content into clear blocks for the grid layout. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                    <div className="hc-card-structure">
                      <div className="hc-card-header">
                        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                          <Typography.Text strong style={{ minWidth: 0 }}>
                            {repo.name || repo.id}
                          </Typography.Text>
                          <Space size={6} wrap>
                            <Tag color={repo.provider === 'github' ? 'geekblue' : 'orange'}>{providerLabel(repo.provider)}</Tag>
                            <Tag color={repo.enabled ? 'green' : 'red'}>
                              {repo.enabled ? t('common.enabled') : t('common.disabled')}
                            </Tag>
                          </Space>
                        </Space>
                      </div>

                      <div className="hc-card-divider" />

                      {/* Structure repo meta rows for shared card styling. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                      <Space size={10} wrap className="hc-card-meta">
                        <Typography.Text type="secondary">{repo.id}</Typography.Text>
                        <Typography.Text type="secondary">{formatTime(repo.updatedAt)}</Typography.Text>
                        <Tag color="geekblue">{robotsText}</Tag>
                        <Tag color="purple">{triggersText}</Tag>
                      </Space>

                      <div className="hc-card-divider" />

                      {/* Keep the repo card CTA aligned for the updated card layout. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw */}
                      <div className="hc-card-actions">
                        <Button
                          size="small"
                          icon={<SettingOutlined />}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openRepo(repo);
                          }}
                        >
                          {t('common.manage')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : loading ? (
          // Use skeleton cards instead of an Empty+icon while the repo list is loading. ro3ln7zex8d0wyynfj0m
          <CardListSkeleton
            count={6}
            cardClassName="hc-repo-card"
            layout="grid"
            testId="hc-repos-skeleton"
            ariaLabel={t('common.loading')}
          />
        ) : (
          <div className="hc-empty">
            <Empty description={loading ? t('common.loading') : t('repos.page.empty')} />
          </div>
        )}
      </div>

      <Modal
        title={t('repos.createModal.title')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        okText={t('common.create')}
        cancelText={t('common.cancel')}
        confirmLoading={createSubmitting}
        onOk={() => createForm.submit()}
        destroyOnHidden
      >
        <Form
          form={createForm}
          layout="vertical"
          requiredMark={false}
          initialValues={{ provider: 'gitlab' as RepoProvider }}
          onFinish={async (values) => {
            setCreateSubmitting(true);
            try {
              const parsed = parseRepoUrl(values.provider, values.repoUrl);
              if (!parsed.ok) {
                // Provide actionable validation errors (owner/repo or provider mismatch) before creating the repo. 58w1q3n5nr58flmempxe
                message.error(
                  parsed.code === 'MISSING_OWNER_REPO'
                    ? t('repos.form.repoUrlOwnerRepoRequired')
                    : parsed.code === 'PROVIDER_MISMATCH'
                      ? t('repos.form.repoUrlProviderMismatch')
                      : t('repos.form.repoUrlInvalid')
                );
                return;
              }

              const created = await createRepo({
                provider: values.provider,
                name: parsed.value.name,
                externalId: parsed.value.externalId || null,
                apiBaseUrl: parsed.value.apiBaseUrl || null
              });
              setCreateOpen(false);
              createForm.resetFields();
              // Navigate to the repo detail onboarding wizard after creation (no webhook popup). 58w1q3n5nr58flmempxe
              window.location.hash = buildRepoHash(created.repo.id);
            } catch (err: any) {
              console.error(err);
              message.error(err?.response?.data?.error || t('repos.createModal.failed'));
            } finally {
              setCreateSubmitting(false);
            }
          }}
        >
          <Form.Item label={t('common.platform')} name="provider" rules={[{ required: true, message: t('repos.form.providerRequired') }]}>
            <Select options={providerOptions} />
          </Form.Item>
          <Form.Item label={t('repos.form.repoUrl')} name="repoUrl" rules={[{ required: true, message: t('repos.form.repoUrlRequired') }]}>
            <Input placeholder={t('repos.form.repoUrlPlaceholder')} />
          </Form.Item>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {t('repos.createModal.tip')}
          </Typography.Paragraph>
        </Form>
      </Modal>
    </div>
  );
};

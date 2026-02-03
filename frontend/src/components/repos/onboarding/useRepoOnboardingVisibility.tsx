// Extract repo visibility onboarding state to reduce wizard complexity. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tag } from 'antd';
import type { RepoProviderVisibility, RepoScopedCredentialsPublic, Repository, UserModelCredentialsPublic } from '../../../api';
import { fetchRepoProviderMeta } from '../../../api';
import type { TFunction } from '../../../i18n';
import { pickRepoProviderCredentials, type RepoProviderCredentialSource } from '../repoProviderCredentials';

export type CredentialSource = RepoProviderCredentialSource;

export const visibilityTag = (t: (key: string, vars?: any) => string, visibility: RepoProviderVisibility) => {
  if (visibility === 'public') return <Tag color="green">{t('repos.onboarding.visibility.public')}</Tag>;
  if (visibility === 'internal') return <Tag color="geekblue">{t('repos.onboarding.visibility.internal')}</Tag>;
  if (visibility === 'private') return <Tag color="volcano">{t('repos.onboarding.visibility.private')}</Tag>;
  return <Tag>{t('repos.onboarding.visibility.unknown')}</Tag>;
};

export const useRepoOnboardingVisibility = ({
  repo,
  repoScopedCredentials,
  userModelCredentials,
  step,
  t
}: {
  repo: Repository;
  repoScopedCredentials: RepoScopedCredentialsPublic | null;
  userModelCredentials: UserModelCredentialsPublic | null;
  step: number;
  t: TFunction;
}) => {
  const [credentialSource, setCredentialSource] = useState<CredentialSource>('anonymous'); // Default to anonymous so public repos can be detected without any credentials. 58w1q3n5nr58flmempxe
  const [credentialProfileId, setCredentialProfileId] = useState<string>('');

  const [visibility, setVisibility] = useState<RepoProviderVisibility>('unknown');
  const [visibilityUrl, setVisibilityUrl] = useState<string>('');
  const [visibilityLoading, setVisibilityLoading] = useState(false);
  const [visibilityError, setVisibilityError] = useState<string>('');
  const autoDetectVisibilityRef = useRef(false); // Ensure onboarding triggers visibility detection only once on first entry. 58w1q3n5nr58flmempxe

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

  return {
    credentialSource,
    setCredentialSource,
    credentialProfileId,
    setCredentialProfileId,
    visibility,
    visibilityUrl,
    visibilityLoading,
    visibilityError,
    visibilityHint,
    repoProviderCreds,
    profileOptions,
    canDetectVisibility,
    handleDetectVisibility
  };
};

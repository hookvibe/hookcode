import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  Divider,
  Form,
  Grid,
  Input,
  Modal,
  Radio,
  Switch,
  Select,
  Space,
  Tag,
  Typography
} from 'antd';
import {
  GlobalOutlined,
  KeyOutlined,
  LinkOutlined,
  LockOutlined,
  LogoutOutlined,
  ReloadOutlined,
  SettingOutlined,
  ToolOutlined,
  UserOutlined,
  CloudServerOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { AccentPreset } from '../theme/accent';
import { ACCENT_PRESET_OPTIONS } from '../theme/accent';
import {
  changeMyPassword,
  fetchAdminToolsMeta,
  fetchSystemRuntimes,
  fetchMe,
  fetchMyModelCredentials,
  listMyModelProviderModels,
  updateMe,
  updateMyModelCredentials,
  type RuntimeInfo,
  type UserModelCredentialsPublic,
  type UserModelProviderCredentialProfilePublic,
  type UserRepoProviderCredentialProfilePublic
} from '../api';
import { ModelProviderModelsButton } from './ModelProviderModelsButton';
import { clearAuth, getStoredUser, getToken, setStoredUser, type AuthUser } from '../auth';
import { setLocale, useLocale, useT } from '../i18n';
import { getBooleanEnv } from '../utils/env';
import { uuid as generateUuid } from './repoAutomation/utils';

/**
 * UserPanelPopover:
 * - Business context: provide a single place to manage "Me / Credentials / Tools / Settings" for `frontend-chat`.
 * - UX goal: open a centered modal so users can edit settings/credentials with more space (instead of a small popover).
 *
 * Notes:
 * - All user-facing copy is i18n'ed (zh-CN + en-US).
 * - Tokens/API keys are never displayed; we only show "configured" flags and accept new secret inputs.
 *
 * Change record:
 * - 2026-01-12: Added for `frontend-chat` migration (replaces legacy account/tools/settings pages).
 * - 2026-01-12: Switched from Popover to centered Modal to match the new panel UX.
 * - 2026-01-12: Redesigned the modal content layout (user summary + accessible nav + responsive behavior).
 * - 2026-01-13: Tightened the panel spacing/typography to increase information density and reduce scrolling.
 * - 2026-01-13: Added Claude Code credential (Anthropic API key) entry to support `claude_code` robots.
 * - 2026-01-13: Added Gemini CLI credential (Gemini API key) entry to support `gemini_cli` robots.
 * - 2026-01-15: Add env feature flag to disable account name/password editing (default enabled; CI can disable it).
 */

type ThemePreference = 'system' | 'light' | 'dark';
type ProviderKey = 'gitlab' | 'github';
type ModelProviderKey = 'codex' | 'claude_code' | 'gemini_cli';
type PanelTab = 'account' | 'credentials' | 'tools' | 'environment' | 'settings';

const DEFAULT_PORTS = { prisma: 7215, swagger: 7216 } as const;

const providerLabel = (provider: ProviderKey) => (provider === 'github' ? 'GitHub' : 'GitLab');
const modelProviderLabel = (provider: ModelProviderKey, t: ReturnType<typeof useT>) => {
  // Map model providers to the user-facing labels used in the unified credential list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
  if (provider === 'codex') return t('panel.credentials.codexTitle');
  if (provider === 'claude_code') return t('panel.credentials.claudeCodeTitle');
  return t('panel.credentials.geminiCliTitle');
};

const buildToolUrl = (params: { port: number; token: string }): string => {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const base = origin || 'http://localhost';
  const url = new URL(base);
  url.port = String(params.port);
  url.pathname = '/';
  url.search = '';
  url.hash = new URLSearchParams({ token: params.token }).toString();
  return url.toString();
};

const normalizeRepoProfiles = (value: unknown): UserRepoProviderCredentialProfilePublic[] =>
  Array.isArray(value) ? (value.filter(Boolean) as any) : [];

const normalizeModelProfiles = (value: unknown): UserModelProviderCredentialProfilePublic[] =>
  Array.isArray(value) ? (value.filter(Boolean) as any) : [];

export interface UserPanelPopoverProps {
  themePreference: ThemePreference;
  onThemePreferenceChange: (pref: ThemePreference) => void;
  accentPreset: AccentPreset;
  onAccentPresetChange: (preset: AccentPreset) => void;
}

export const UserPanelPopover: FC<UserPanelPopoverProps> = ({
  themePreference,
  onThemePreferenceChange,
  accentPreset,
  onAccentPresetChange
}) => {
  const t = useT();
  const locale = useLocale();
  const { message } = App.useApp();
  const screens = Grid.useBreakpoint();
  const isCompactScreen = !screens.md;

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('account');

  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [userLoading, setUserLoading] = useState(false);

  const [credLoading, setCredLoading] = useState(false);
  const [credentials, setCredentials] = useState<UserModelCredentialsPublic | null>(null);
  const [savingCred, setSavingCred] = useState(false);

  const [toolsPorts, setToolsPorts] = useState(DEFAULT_PORTS);
  const [toolsLoading, setToolsLoading] = useState(false);
  // Track detected runtimes for the environment panel. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  const [runtimes, setRuntimes] = useState<RuntimeInfo[]>([]);
  const [runtimesLoading, setRuntimesLoading] = useState(false);
  const [runtimesDetectedAt, setRuntimesDetectedAt] = useState<string | null>(null);

  const [repoProfileFormOpen, setRepoProfileFormOpen] = useState(false);
  const [repoProfileProvider, setRepoProfileProvider] = useState<ProviderKey>('gitlab');
  const [repoProfileEditing, setRepoProfileEditing] = useState<UserRepoProviderCredentialProfilePublic | null>(null);
  const [repoProfileSubmitting, setRepoProfileSubmitting] = useState(false);
  const [repoProfileSetDefault, setRepoProfileSetDefault] = useState(false);
  const [repoProfileForm] = Form.useForm<{ remark: string; token?: string; cloneUsername?: string }>();
  const [repoProfileTokenMode, setRepoProfileTokenMode] = useState<'keep' | 'set'>('keep');

  const [modelProfileFormOpen, setModelProfileFormOpen] = useState(false);
  const [modelProfileProvider, setModelProfileProvider] = useState<ModelProviderKey>('codex');
  const [modelProfileEditing, setModelProfileEditing] = useState<UserModelProviderCredentialProfilePublic | null>(null);
  const [modelProfileSubmitting, setModelProfileSubmitting] = useState(false);
  const [modelProfileSetDefault, setModelProfileSetDefault] = useState(false);
  const [modelProfileForm] = Form.useForm<{ remark: string; apiKey?: string; apiBaseUrl?: string }>();
  const [modelProfileApiKeyMode, setModelProfileApiKeyMode] = useState<'keep' | 'set'>('keep');

  const [displayNameForm] = Form.useForm<{ displayName: string }>();
  const [passwordForm] = Form.useForm<{ currentPassword: string; newPassword: string; confirm: string }>();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const token = getToken();
  const canUseAccountApis = Boolean(token);

  // Feature toggle (2026-01-15):
  // - Business context: Frontend / User panel / Account.
  // - Purpose: allow CI/staging deployments to disable display-name/password editing without removing other tabs.
  // - Default: enabled (flag unset/false) to keep local development behavior unchanged.
  const accountEditDisabled = getBooleanEnv('VITE_DISABLE_ACCOUNT_EDIT', false);

  const tabTitleKey = useMemo(
    () =>
      ({
        account: 'panel.tabs.account',
        credentials: 'panel.tabs.credentials',
        tools: 'panel.tabs.tools',
        environment: 'panel.tabs.environment',
        settings: 'panel.tabs.settings'
      }) as const,
    []
  );

  const tabDescKey = useMemo(
    () =>
      ({
        account: 'panel.header.desc.account',
        credentials: 'panel.header.desc.credentials',
        tools: 'panel.header.desc.tools',
        environment: 'panel.header.desc.environment',
        settings: 'panel.header.desc.settings'
      }) as const,
    []
  );

  const tabIcon = useMemo(
    () =>
      ({
        account: <UserOutlined />,
        credentials: <KeyOutlined />,
        tools: <CloudServerOutlined />,
        environment: <GlobalOutlined />,
        settings: <SettingOutlined />
      }) as const,
    []
  );

  const isTabDisabled = useCallback(
    (tab: PanelTab) => {
      // Business rule: unauthenticated users can still change local-only settings (language/theme/accent).
      if (tab === 'settings') return false;
      return !canUseAccountApis;
    },
    [canUseAccountApis]
  );

  const refreshUser = useCallback(async () => {
    if (!canUseAccountApis) return;
    setUserLoading(true);
    try {
      const data = await fetchMe();
      const next: AuthUser = {
        id: data.id,
        username: data.username,
        displayName: data.displayName,
        roles: data.roles
      };
      setUser(next);
      setStoredUser(next);
      displayNameForm.setFieldsValue({ displayName: next.displayName ?? '' });
    } catch (err) {
      console.error(err);
      // Do not toast here: the panel should remain usable even if `/users/me` is not available.
    } finally {
      setUserLoading(false);
    }
  }, [canUseAccountApis, displayNameForm, token]);

  const refreshCredentials = useCallback(async () => {
    if (!canUseAccountApis) return;
    setCredLoading(true);
    try {
      const data = await fetchMyModelCredentials();
      setCredentials(data);
    } catch (err) {
      console.error(err);
      message.error(t('toast.credentials.fetchFailed'));
      setCredentials(null);
    } finally {
      setCredLoading(false);
    }
  }, [canUseAccountApis, message, t, token]);

  const refreshToolsMeta = useCallback(async () => {
    if (!canUseAccountApis) return;
    setToolsLoading(true);
    try {
      const meta = await fetchAdminToolsMeta();
      if (meta?.enabled && meta.ports) {
        setToolsPorts({
          prisma: Number(meta.ports.prisma) || DEFAULT_PORTS.prisma,
          swagger: Number(meta.ports.swagger) || DEFAULT_PORTS.swagger
        });
      } else {
        setToolsPorts(DEFAULT_PORTS);
      }
    } catch {
      setToolsPorts(DEFAULT_PORTS);
    } finally {
      setToolsLoading(false);
    }
  }, [canUseAccountApis, token]);

  const refreshRuntimes = useCallback(async () => {
    // Load detected runtimes for the environment panel. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (!canUseAccountApis) return;
    setRuntimesLoading(true);
    try {
      const data = await fetchSystemRuntimes();
      setRuntimes(Array.isArray(data?.runtimes) ? data.runtimes : []);
      setRuntimesDetectedAt(data?.detectedAt ?? null);
    } catch (err) {
      console.error(err);
      message.error(t('toast.runtimes.fetchFailed'));
      setRuntimes([]);
      setRuntimesDetectedAt(null);
    } finally {
      setRuntimesLoading(false);
    }
  }, [canUseAccountApis, message, t]);

  useEffect(() => {
    if (!open) return;
    void refreshUser();
    if (activeTab === 'credentials') void refreshCredentials();
    if (activeTab === 'tools') void refreshToolsMeta();
    // Refresh runtime detection when switching to the environment tab. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
    if (activeTab === 'environment') void refreshRuntimes();
  }, [activeTab, open, refreshCredentials, refreshRuntimes, refreshToolsMeta, refreshUser]);

  useEffect(() => {
    // UX guard: when not authenticated, keep the panel focused on local-only settings to avoid 401 redirects.
    if (!canUseAccountApis && activeTab !== 'settings') {
      setActiveTab('settings');
    }
  }, [activeTab, canUseAccountApis]);

  const headerRefreshing = useMemo(() => {
    if (!canUseAccountApis) return false;
    if (activeTab === 'account') return userLoading;
    if (activeTab === 'credentials') return credLoading;
    if (activeTab === 'tools') return toolsLoading;
    if (activeTab === 'environment') return runtimesLoading;
    return false;
  }, [activeTab, canUseAccountApis, credLoading, runtimesLoading, toolsLoading, userLoading]);

  const refreshActiveTab = useCallback(async () => {
    if (!canUseAccountApis) return;
    // UX: keep refresh contextual so we avoid multiple concurrent API calls.
    if (activeTab === 'account') await refreshUser();
    if (activeTab === 'credentials') await refreshCredentials();
    if (activeTab === 'tools') await refreshToolsMeta();
    if (activeTab === 'environment') await refreshRuntimes();
  }, [activeTab, canUseAccountApis, refreshCredentials, refreshRuntimes, refreshToolsMeta, refreshUser]);

  const logout = useCallback(() => {
    Modal.confirm({
      title: t('panel.logout.confirmTitle'),
      content: t('panel.logout.confirmDesc'),
      okText: t('panel.logout.ok'),
      cancelText: t('common.cancel'),
      onOk: () => {
        clearAuth();
        window.location.hash = '#/login';
      }
    });
  }, [t]);

  const toolCards = useMemo(
    () => [
      { key: 'prisma', icon: <ToolOutlined />, titleKey: 'panel.tools.prisma', port: toolsPorts.prisma },
      { key: 'swagger', icon: <ToolOutlined />, titleKey: 'panel.tools.swagger', port: toolsPorts.swagger }
    ],
    [toolsPorts.prisma, toolsPorts.swagger]
  );

  const openTool = useCallback(
    (port: number) => {
      const tokenValue = getToken();
      if (!tokenValue) {
        message.warning(t('panel.notLoggedIn'));
        return;
      }
      const url = buildToolUrl({ port, token: tokenValue });
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    [message, t]
  );

  const repoProviderProfiles = useMemo(() => {
    const gitlabProfiles = normalizeRepoProfiles(credentials?.gitlab?.profiles);
    const githubProfiles = normalizeRepoProfiles(credentials?.github?.profiles);
    return { gitlab: gitlabProfiles, github: githubProfiles };
  }, [credentials?.github?.profiles, credentials?.gitlab?.profiles]);

  const modelProviderProfiles = useMemo(() => {
    const codexProfiles = normalizeModelProfiles(credentials?.codex?.profiles);
    const claudeProfiles = normalizeModelProfiles(credentials?.claude_code?.profiles);
    const geminiProfiles = normalizeModelProfiles(credentials?.gemini_cli?.profiles);
    return { codex: codexProfiles, claude_code: claudeProfiles, gemini_cli: geminiProfiles };
  }, [credentials?.claude_code?.profiles, credentials?.codex?.profiles, credentials?.gemini_cli?.profiles]);

  // Build unified repo provider profile items for the single list view. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
  const repoProviderProfileItems = useMemo(
    () =>
      (['gitlab', 'github'] as ProviderKey[]).flatMap((provider) => {
        const profiles = repoProviderProfiles[provider];
        const defaultId = String((credentials as any)?.[provider]?.defaultProfileId ?? '').trim();
        return profiles.map((profile) => ({ provider, profile, defaultId }));
      }),
    [credentials, repoProviderProfiles]
  );

  // Build unified model provider profile items for the single list view. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
  const modelProviderProfileItems = useMemo(
    () =>
      (['codex', 'claude_code', 'gemini_cli'] as ModelProviderKey[]).flatMap((provider) => {
        const profiles = modelProviderProfiles[provider];
        const defaultId = String((credentials as any)?.[provider]?.defaultProfileId ?? '').trim();
        return profiles.map((profile) => ({ provider, profile, defaultId }));
      }),
    [credentials, modelProviderProfiles]
  );

  const startEditRepoProfile = useCallback(
    (provider?: ProviderKey, profile?: UserRepoProviderCredentialProfilePublic | null) => {
      const nextProvider = provider ?? repoProfileProvider ?? 'gitlab';
      // Keep the selected repo provider in sync with the unified list modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      setRepoProfileProvider(nextProvider);
      setRepoProfileEditing(profile ?? null);
      setRepoProfileFormOpen(true);

      const initialRemark = profile?.remark ?? '';
      const initialCloneUsername = profile?.cloneUsername ?? '';

      // UX: keep existing tokens by default (backend never returns raw tokens).
      setRepoProfileTokenMode(profile?.hasToken ? 'keep' : 'set');
      // Default selection is now handled inside the manage modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      const defaultId = String((credentials as any)?.[nextProvider]?.defaultProfileId ?? '').trim();
      setRepoProfileSetDefault(Boolean(profile?.id && profile.id === defaultId));
      repoProfileForm.setFieldsValue({ remark: initialRemark, cloneUsername: initialCloneUsername, token: '' });
    },
    [credentials, repoProfileForm, repoProfileProvider]
  );

  const startEditModelProfile = useCallback(
    (provider?: ModelProviderKey, profile?: UserModelProviderCredentialProfilePublic | null) => {
      const nextProvider = provider ?? modelProfileProvider ?? 'codex';
      // Keep the selected model provider in sync with the unified list modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      setModelProfileProvider(nextProvider);
      setModelProfileEditing(profile ?? null);
      setModelProfileFormOpen(true);

      const initialRemark = profile?.remark ?? '';
      const initialApiBaseUrl = profile?.apiBaseUrl ?? '';

      // UX: keep existing keys by default (backend never returns raw apiKey).
      setModelProfileApiKeyMode(profile?.hasApiKey ? 'keep' : 'set');
      // Default selection is now handled inside the manage modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      const defaultId = String((credentials as any)?.[nextProvider]?.defaultProfileId ?? '').trim();
      setModelProfileSetDefault(Boolean(profile?.id && profile.id === defaultId));
      modelProfileForm.setFieldsValue({ remark: initialRemark, apiBaseUrl: initialApiBaseUrl, apiKey: '' });
    },
    [credentials, modelProfileForm, modelProfileProvider]
  );

  const setProviderDefault = useCallback(
    async (provider: ProviderKey | ModelProviderKey, nextDefaultId: string | null) => {
      if (savingCred) return;
      setSavingCred(true);
      try {
        const next = await updateMyModelCredentials({
          [provider]: { defaultProfileId: nextDefaultId || null }
        } as any);
        setCredentials(next);
        message.success(t('toast.credentials.saved'));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      } finally {
        setSavingCred(false);
      }
    },
    [message, savingCred, t]
  );

  const removeProfile = useCallback(
    async (provider: ProviderKey | ModelProviderKey, id: string) => {
      Modal.confirm({
        title: t('panel.credentials.profile.removeTitle'),
        content: t('panel.credentials.profile.removeDesc'),
        okText: t('panel.credentials.profile.removeOk'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        onOk: async () => {
          if (savingCred) return;
          setSavingCred(true);
          try {
            const next = await updateMyModelCredentials({
              [provider]: { removeProfileIds: [id] }
            } as any);
            setCredentials(next);
            message.success(t('toast.credentials.saved'));
          } catch (err: any) {
            console.error(err);
            message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
          } finally {
            setSavingCred(false);
          }
        }
      });
    },
    [message, savingCred, t]
  );

  const submitRepoProfileForm = useCallback(async () => {
    if (repoProfileSubmitting) return;
    const values = await repoProfileForm.validateFields();
    setRepoProfileSubmitting(true);
    try {
      const remark = String(values.remark ?? '').trim();
      const cloneUsername = String(values.cloneUsername ?? '').trim();
      const tokenValue = String(values.token ?? '').trim();
      const shouldSendToken = repoProfileTokenMode === 'set';

      const currentDefaultId = String((credentials as any)?.[repoProfileProvider]?.defaultProfileId ?? '').trim();
      const profileId = repoProfileEditing?.id ?? generateUuid();
      const payload = {
        id: profileId,
        remark: remark || null,
        cloneUsername: cloneUsername || null,
        ...(shouldSendToken ? { token: tokenValue ? tokenValue : null } : {})
      };

      const isEditingDefault = Boolean(repoProfileEditing?.id && repoProfileEditing.id === currentDefaultId);
      const updatePayload: any = {
        [repoProfileProvider]: {
          profiles: [payload]
        }
      };
      // Default selection now lives inside the manage modal instead of a separate dropdown. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      if (repoProfileSetDefault) {
        updatePayload[repoProfileProvider].defaultProfileId = profileId;
      } else if (isEditingDefault) {
        updatePayload[repoProfileProvider].defaultProfileId = null;
      }

      const next = await updateMyModelCredentials(updatePayload as any);

      setCredentials(next);
      setRepoProfileFormOpen(false);
      setRepoProfileEditing(null);
      message.success(t('toast.credentials.saved'));
    } catch (err: any) {
      if (err?.errorFields) {
        // Form validation error; no toast.
      } else {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      }
    } finally {
      setRepoProfileSubmitting(false);
    }
  }, [
    message,
    repoProfileEditing?.id,
    repoProfileForm,
    repoProfileProvider,
    repoProfileSubmitting,
    repoProfileSetDefault,
    repoProfileTokenMode,
    t
  ]);

  const submitModelProfileForm = useCallback(async () => {
    if (modelProfileSubmitting) return;
    const values = await modelProfileForm.validateFields();
    setModelProfileSubmitting(true);
    try {
      const remark = String(values.remark ?? '').trim();
      const apiBaseUrl = String(values.apiBaseUrl ?? '').trim();
      const apiKey = String(values.apiKey ?? '').trim();
      const shouldSendApiKey = modelProfileApiKeyMode === 'set';

      const currentDefaultId = String((credentials as any)?.[modelProfileProvider]?.defaultProfileId ?? '').trim();
      const profileId = modelProfileEditing?.id ?? generateUuid();
      const payload = {
        id: profileId,
        remark: remark || null,
        apiBaseUrl: apiBaseUrl || null,
        ...(shouldSendApiKey ? { apiKey: apiKey ? apiKey : null } : {})
      };

      const isEditingDefault = Boolean(modelProfileEditing?.id && modelProfileEditing.id === currentDefaultId);
      const updatePayload: any = {
        [modelProfileProvider]: {
          profiles: [payload]
        }
      };
      // Default selection now lives inside the manage modal instead of a separate dropdown. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      if (modelProfileSetDefault) {
        updatePayload[modelProfileProvider].defaultProfileId = profileId;
      } else if (isEditingDefault) {
        updatePayload[modelProfileProvider].defaultProfileId = null;
      }

      const next = await updateMyModelCredentials(updatePayload as any);

      setCredentials(next);
      setModelProfileFormOpen(false);
      setModelProfileEditing(null);
      message.success(t('toast.credentials.saved'));
    } catch (err: any) {
      if (err?.errorFields) {
        // Form validation error; no toast.
      } else {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      }
    } finally {
      setModelProfileSubmitting(false);
    }
  }, [
    message,
    modelProfileApiKeyMode,
    modelProfileEditing?.id,
    modelProfileForm,
    modelProfileProvider,
    modelProfileSubmitting,
    modelProfileSetDefault,
    t
  ]);

  const saveDisplayName = useCallback(async () => {
    if (accountEditDisabled) return;
    if (!canUseAccountApis) return;
    if (savingProfile) return;
    const values = await displayNameForm.validateFields();
    setSavingProfile(true);
    try {
      const nextName = String(values.displayName ?? '').trim();
      const updated = await updateMe({ displayName: nextName ? nextName : null });
      const nextUser = user
        ? { ...user, displayName: updated.displayName }
        : { id: updated.id, username: updated.username, displayName: updated.displayName };
      setUser(nextUser as any);
      setStoredUser(nextUser as any);
      message.success(t('toast.account.saved'));
    } catch (err) {
      console.error(err);
      message.error(t('toast.account.saveFailed'));
    } finally {
      setSavingProfile(false);
    }
  }, [accountEditDisabled, canUseAccountApis, displayNameForm, message, savingProfile, t, user]);

  const savePassword = useCallback(async () => {
    if (accountEditDisabled) return;
    if (!canUseAccountApis) return;
    if (savingPassword) return;
    const values = await passwordForm.validateFields();
    setSavingPassword(true);
    try {
      await changeMyPassword({ currentPassword: values.currentPassword, newPassword: values.newPassword });
      passwordForm.resetFields();
      message.success(t('toast.account.passwordSaved'));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        message.error(t('toast.account.passwordIncorrect'));
      } else {
        console.error(err);
        message.error(t('toast.account.passwordSaveFailed'));
      }
    } finally {
      setSavingPassword(false);
    }
  }, [accountEditDisabled, canUseAccountApis, message, passwordForm, savingPassword, t]);

  const accentOptions = useMemo(
    () =>
      ACCENT_PRESET_OPTIONS.map((opt) => ({
        value: opt.key,
        label: (
          <Space size={8}>
            <span
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: opt.primary,
                boxShadow: 'inset 0 0 0 1px var(--hc-border)'
              }}
            />
            <span>{t(`settings.accent.${opt.key}` as any)}</span>
          </Space>
        )
      })),
    [t]
  );

  const closePanel = useCallback(() => {
    setOpen(false);
    setProfileFormOpen(false);
    setProfileEditing(null);
  }, []);

  const renderNavItem = (tab: PanelTab) => {
    const disabled = isTabDisabled(tab);
    const active = activeTab === tab;
    return (
      <button
        key={tab}
        type="button"
        className={`hc-settings-nav-item${active ? ' hc-settings-nav-item--active' : ''}`}
        onClick={() => setActiveTab(tab)}
        disabled={disabled}
        aria-current={active ? 'page' : undefined}
        aria-label={t(tabTitleKey[tab])}
      >
        <span className="hc-settings-nav-item__icon" aria-hidden="true">
          {tabIcon[tab]}
        </span>
        <span className="hc-settings-nav-item__label">{t(tabTitleKey[tab])}</span>
      </button>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <>
            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.account.profileTitle')}</div>
              {/* UX (2026-01-15): Use the default (middle) control size + placeholders to avoid "thin" inputs and improve scanability. */}
              <Form form={displayNameForm} layout="vertical" requiredMark={false} size="middle">
                <Form.Item label={t('panel.account.displayName')} name="displayName">
                  <Input placeholder={t('panel.account.displayNamePlaceholder')} disabled={accountEditDisabled} />
                </Form.Item>
                <Button
                  type="primary"
                  icon={<SettingOutlined />}
                  onClick={() => void saveDisplayName()}
                  loading={savingProfile}
                  disabled={!canUseAccountApis || accountEditDisabled}
                >
                  {t('common.save')}
                </Button>
              </Form>
            </div>

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.account.passwordTitle')}</div>
              {/* UX (2026-01-15): Use the default (middle) control size + placeholders to keep password forms consistent with other panels. */}
              <Form form={passwordForm} layout="vertical" requiredMark={false} size="middle">
                <Form.Item
                  label={t('panel.account.currentPassword')}
                  name="currentPassword"
                  rules={[{ required: true, message: t('panel.validation.required') }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t('panel.account.currentPasswordPlaceholder')}
                    autoComplete="current-password"
                    disabled={accountEditDisabled}
                  />
                </Form.Item>
                <Form.Item
                  label={t('panel.account.newPassword')}
                  name="newPassword"
                  rules={[{ required: true, message: t('panel.validation.required') }, { min: 6, message: t('panel.validation.passwordTooShort') }]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t('panel.account.newPasswordPlaceholder')}
                    autoComplete="new-password"
                    disabled={accountEditDisabled}
                  />
                </Form.Item>
                <Form.Item
                  label={t('panel.account.confirmPassword')}
                  name="confirm"
                  dependencies={['newPassword']}
                  rules={[
                    { required: true, message: t('panel.validation.required') },
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || getFieldValue('newPassword') === value) return Promise.resolve();
                        return Promise.reject(new Error(t('panel.validation.passwordMismatch')));
                      }
                    })
                  ]}
                >
                  <Input.Password
                    prefix={<LockOutlined />}
                    placeholder={t('panel.account.confirmPasswordPlaceholder')}
                    autoComplete="new-password"
                    disabled={accountEditDisabled}
                  />
                </Form.Item>
                <Button
                  type="primary"
                  icon={<KeyOutlined />}
                  onClick={() => void savePassword()}
                  loading={savingPassword}
                  disabled={!canUseAccountApis || accountEditDisabled}
                >
                  {t('panel.account.updatePassword')}
                </Button>
              </Form>
            </div>

	          </>
	        );

      case 'credentials':
        return (
          <>
            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.credentials.modelProviderTitle')}</div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 10 }}>
                {t('panel.credentials.modelProviderTip')}
              </Typography.Paragraph>
              <Card
                size="small"
                title={
                  <Space size={8}>
                    <KeyOutlined />
                    <span>{t('panel.credentials.modelProviderTitle')}</span>
                  </Space>
                }
                extra={
                  <>
                    {/* Use a single add entry point for the unified model list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                    <Button size="small" onClick={() => startEditModelProfile(undefined, null)} disabled={savingCred || !canUseAccountApis}>
                      {t('panel.credentials.profile.add')}
                    </Button>
                  </>
                }
              >
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  {/* Keep per-provider defaults while rendering a single unified model list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                  <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                    {(['codex', 'claude_code', 'gemini_cli'] as ModelProviderKey[]).map((provider) => {
                      const profiles = modelProviderProfiles[provider];
                      const defaultId = String((credentials as any)?.[provider]?.defaultProfileId ?? '').trim();
                      return (
                        <div key={provider}>
                          <Typography.Text type="secondary">
                            {t('panel.credentials.profile.default')} · {modelProviderLabel(provider, t)}
                          </Typography.Text>
                          <div style={{ marginTop: 6 }}>
                            <Select
                              value={defaultId || undefined}
                              style={{ width: '100%' }}
                              placeholder={t('panel.credentials.profile.defaultPlaceholder')}
                              onChange={(value) => void setProviderDefault(provider, value ? String(value) : null)}
                              options={profiles.map((p) => ({ value: p.id, label: p.remark || p.id }))}
                              allowClear
                              disabled={savingCred || !canUseAccountApis}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </Space>

                  {/* Render a single list of model provider profiles with provider tags. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                  {modelProviderProfileItems.length ? (
                    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                      {modelProviderProfileItems.map(({ provider, profile, defaultId }) => (
                        <Card key={`${provider}-${profile.id}`} size="small" className="hc-inner-card" styles={{ body: { padding: 8 } }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                            <Space size={8} wrap>
                              <Typography.Text strong>{profile.remark || profile.id}</Typography.Text>
                              <Tag color="geekblue">{modelProviderLabel(provider, t)}</Tag>
                              {defaultId === profile.id ? <Tag color="blue">{t('panel.credentials.profile.defaultTag')}</Tag> : null}
                              <Tag color={profile.hasApiKey ? 'green' : 'default'}>
                                {profile.hasApiKey ? t('common.configured') : t('common.notConfigured')}
                              </Tag>
                            </Space>
                            <Typography.Text type="secondary">{profile.apiBaseUrl || '-'}</Typography.Text>
                          </Space>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                            <Button size="small" onClick={() => startEditModelProfile(provider, profile)}>
                              {t('common.manage')}
                            </Button>
                            <Button size="small" danger onClick={() => void removeProfile(provider, profile.id)} disabled={!canUseAccountApis}>
                              {t('panel.credentials.profile.remove')}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">{t('panel.credentials.profile.empty')}</Typography.Text>
                  )}
                </Space>
              </Card>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.credentials.repoTitle')}</div>
              <Card
                size="small"
                title={
                  <Space size={8}>
                    <GlobalOutlined />
                    <span>{t('panel.credentials.repoTitle')}</span>
                  </Space>
                }
                extra={
                  <>
                    {/* Use a single add entry point for the unified repo list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                    <Button size="small" onClick={() => startEditRepoProfile(undefined, null)} disabled={savingCred || !canUseAccountApis}>
                      {t('panel.credentials.profile.add')}
                    </Button>
                  </>
                }
              >
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                  {/* Keep per-provider defaults while rendering a single unified repo list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                  <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                    {(['gitlab', 'github'] as ProviderKey[]).map((provider) => {
                      const profiles = repoProviderProfiles[provider];
                      const defaultId = String((credentials as any)?.[provider]?.defaultProfileId ?? '').trim();
                      return (
                        <div key={provider}>
                          <Typography.Text type="secondary">
                            {t('panel.credentials.profile.default')} · {providerLabel(provider)}
                          </Typography.Text>
                          <div style={{ marginTop: 6 }}>
                            <Select
                              value={defaultId || undefined}
                              style={{ width: '100%' }}
                              placeholder={t('panel.credentials.profile.defaultPlaceholder')}
                              onChange={(value) => void setProviderDefault(provider, value ? String(value) : null)}
                              options={profiles.map((p) => ({ value: p.id, label: p.remark || p.id }))}
                              allowClear
                              disabled={savingCred || !canUseAccountApis}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </Space>

                  {/* Render a single list of repo provider profiles with provider tags. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                  {repoProviderProfileItems.length ? (
                    <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                      {repoProviderProfileItems.map(({ provider, profile, defaultId }) => (
                        <Card key={`${provider}-${profile.id}`} size="small" className="hc-inner-card" styles={{ body: { padding: 8 } }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                            <Space size={8} wrap>
                              <Typography.Text strong>{profile.remark || profile.id}</Typography.Text>
                              <Tag color="geekblue">{providerLabel(provider)}</Tag>
                              {defaultId === profile.id ? <Tag color="blue">{t('panel.credentials.profile.defaultTag')}</Tag> : null}
                              <Tag color={profile.hasToken ? 'green' : 'default'}>
                                {profile.hasToken ? t('common.configured') : t('common.notConfigured')}
                              </Tag>
                            </Space>
                            <Typography.Text type="secondary">{profile.cloneUsername || '-'}</Typography.Text>
                          </Space>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                            <Button size="small" onClick={() => startEditRepoProfile(provider, profile)}>
                              {t('common.manage')}
                            </Button>
                            <Button size="small" danger onClick={() => void removeProfile(provider, profile.id)} disabled={!canUseAccountApis}>
                              {t('panel.credentials.profile.remove')}
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </Space>
                  ) : (
                    <Typography.Text type="secondary">{t('panel.credentials.profile.empty')}</Typography.Text>
                  )}
                </Space>
              </Card>
            </div>
          </>
        );

      case 'tools':
        return (
          <div className="hc-settings-section">
            <div className="hc-settings-section-title">{t('panel.tabs.tools')}</div>
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {toolCards.map((tool) => (
                <Card
                  key={tool.key}
                  size="small"
                  className="hc-panel-card"
                  title={
                    <Space size={8}>
                      {tool.icon} <span>{t(tool.titleKey as any)}</span>
                    </Space>
                  }
                  loading={toolsLoading}
                >
                  <Space size={8} wrap>
                    <Button
                      type="primary"
                      size="small"
                      icon={<LinkOutlined />}
                      onClick={() => openTool(tool.port)}
                      disabled={!canUseAccountApis}
                    >
                      {t('panel.tools.open')}
                    </Button>
                    <Typography.Text type="secondary">{t('panel.tools.portHint', { port: tool.port })}</Typography.Text>
                  </Space>
                </Card>
              ))}
            </Space>
          </div>
        );

      case 'environment':
        // Render runtime availability for multi-language dependency installs. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
        return (
          <div className="hc-settings-section">
            <div className="hc-settings-section-title">{t('panel.environment.availableTitle')}</div>
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              {t('panel.environment.tip')}
            </Typography.Paragraph>
            <Space orientation="vertical" size={10} style={{ width: '100%' }}>
              {runtimesLoading ? (
                <Card loading size="small" />
              ) : runtimes.length ? (
                runtimes.map((rt) => (
                  <Card key={`${rt.language}-${rt.version}`} size="small" className="hc-panel-card">
                    <Space size={8} wrap>
                      <Tag color="green">{rt.language}</Tag>
                      <Typography.Text>{rt.version}</Typography.Text>
                      <Typography.Text type="secondary">{rt.packageManager || '-'}</Typography.Text>
                    </Space>
                    <div style={{ marginTop: 6 }}>
                      <Typography.Text type="secondary">{rt.path}</Typography.Text>
                    </div>
                  </Card>
                ))
              ) : (
                <Typography.Text type="secondary">{t('panel.environment.empty')}</Typography.Text>
              )}
            </Space>
            <Divider style={{ margin: '16px 0' }} />
            <Space size={8} wrap>
              <Typography.Text type="secondary">{t('panel.environment.detectedAt')}</Typography.Text>
              <Typography.Text type="secondary">{runtimesDetectedAt || '-'}</Typography.Text>
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              {t('panel.environment.customImageHint')}
            </Typography.Paragraph>
          </div>
        );

      case 'settings':
      default:
        return (
          <>
            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.settings.generalTitle')}</div>
              <div style={{ marginBottom: 14 }}>
                <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                  {t('panel.settings.languageTitle')}
                </Typography.Text>
                {/* UX (2026-01-15): Keep settings controls full-width to match other modal content (avoid narrow selects). */}
                <Select
                  value={locale}
                  style={{ width: '100%' }}
                  onChange={(value) => setLocale(value)}
                  options={[
                    { value: 'zh-CN', label: t('panel.settings.lang.zhCN') },
                    { value: 'en-US', label: t('panel.settings.lang.enUS') }
                  ]}
                />
              </div>
            </div>

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.settings.themeTitle')}</div>
              <div className="hc-theme-cards">
                {[
                    { key: 'light', label: t('common.theme.light') },
                    { key: 'dark', label: t('common.theme.dark') },
                    { key: 'system', label: t('common.theme.system') }
                ].map((th) => (
                    <div
                        key={th.key}
                        className={`hc-theme-card hc-theme-card--${th.key} ${themePreference === th.key ? 'hc-theme-card--active' : ''}`}
                        onClick={() => onThemePreferenceChange(th.key as any)}
                    >
                        <div className="hc-theme-card-preview" />
                        <div className="hc-theme-card-label">{th.label}</div>
                    </div>
                ))}
              </div>
            </div>

            <div className="hc-settings-section">
                <div className="hc-settings-section-title">{t('panel.settings.accentTitle')}</div>
                {/* UX (2026-01-15): Keep settings controls full-width to match other modal content (avoid narrow selects). */}
                <Select
                    value={accentPreset}
                    style={{ width: '100%' }}
                    onChange={(value) => onAccentPresetChange(value as any)}
                    options={accentOptions as any}
                />
            </div>
          </>
        );
    }
  };

  const userPrimaryText = useMemo(() => {
    if (!canUseAccountApis) return t('panel.notLoggedIn');
    return user?.displayName?.trim() || user?.username?.trim() || t('panel.user.unknown');
  }, [canUseAccountApis, t, user?.displayName, user?.username]);

  const userSecondaryText = useMemo(() => {
    if (!canUseAccountApis) return t('panel.header.userHint.signedOut');
    if (!user) return t('panel.user.notAvailable');
    return user.username ? `@${user.username}` : t('panel.user.notAvailable');
  }, [canUseAccountApis, t, user]);

  const userRoleTags = useMemo(() => {
    if (!canUseAccountApis) return [];
    const roles = Array.isArray(user?.roles) ? user!.roles.filter(Boolean) : [];
    return roles.slice(0, 2).map(String);
  }, [canUseAccountApis, user?.roles]);

  const content = (
    <div className="hc-user-panel" data-density="compact">
      {/* UX (2026-01-13): Opt-in to the compact density rules in `styles.css` for a denser settings panel. */}
      {/* Visual Sidebar */}
      <div className="hc-user-panel__sidebar">
        <div className="hc-user-panel__sidebar-header">
          <div className="hc-user-panel__user">
            <div className="hc-user-panel__user-avatar" aria-hidden="true">
              <UserOutlined />
            </div>
            <div className="hc-user-panel__user-text">
              <div className="hc-user-panel__user-primary">{userPrimaryText}</div>
              <div className="hc-user-panel__user-secondary">{userSecondaryText}</div>
              {userRoleTags.length ? (
                <div className="hc-user-panel__user-roles">
                  {userRoleTags.map((role) => (
                    <Tag key={role} color="blue">
                      {role}
                    </Tag>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hc-user-panel__nav">
          <div className="hc-user-panel__nav-group">
            <div className="hc-user-panel__nav-header">{t('panel.nav.group.account')}</div>
            {renderNavItem('account')}
          </div>

          <div className="hc-user-panel__nav-group">
            <div className="hc-user-panel__nav-header">{t('panel.nav.group.integrations')}</div>
            {renderNavItem('credentials')}
            {renderNavItem('tools')}
            {/* Add environment tab for runtime visibility. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
            {renderNavItem('environment')}
          </div>

          <div className="hc-user-panel__nav-group">
            <div className="hc-user-panel__nav-header">{t('panel.nav.group.preferences')}</div>
            {renderNavItem('settings')}
          </div>
        </div>

        <div className="hc-user-panel__sidebar-footer">
          <Button
            danger
            size="small"
            icon={<LogoutOutlined />}
            onClick={logout}
            disabled={!canUseAccountApis}
          >
            {t('panel.logout.ok')}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="hc-user-panel__content">
        <div className="hc-user-panel__content-header">
          <div className="hc-user-panel__content-titleArea">
            <div className="hc-user-panel__content-title">{t(tabTitleKey[activeTab])}</div>
            <div className="hc-user-panel__content-subtitle">{t(tabDescKey[activeTab])}</div>
          </div>
          <div className="hc-user-panel__content-actions">
            {activeTab !== 'settings' ? (
              <Button
                type="text"
                aria-label={t('common.refresh')}
                icon={<ReloadOutlined />}
                loading={headerRefreshing}
                onClick={() => void refreshActiveTab()}
                disabled={!canUseAccountApis}
                className="hc-user-panel__header-action"
              />
            ) : null}
            <button type="button" className="hc-user-panel__close" onClick={closePanel} aria-label={t('common.close')}>
              <CloseOutlined style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>
        <div className="hc-user-panel__content-body">
          {renderContent()}
        </div>
      </div>

      {/* Re-use existing profile modal inside */}
      <Modal
        title={repoProfileEditing ? t('panel.credentials.profile.editTitle') : t('panel.credentials.profile.addTitle')}
        open={repoProfileFormOpen}
        className="hc-dialog--compact" /* UX (2026-01-15): tighter padding + unified surface in dark mode for profile editors. */
        onCancel={() => {
            setRepoProfileFormOpen(false);
            setRepoProfileEditing(null);
        }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={repoProfileSubmitting}
        onOk={() => void submitRepoProfileForm()}
        destroyOnHidden
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            {/* Allow choosing repo provider when creating profiles from the unified list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
            {/* UX (2026-01-15): Use default control sizing inside modals (avoid overly compact inputs). */}
            <Form form={repoProfileForm} layout="vertical" requiredMark={false} size="middle">
            <Form.Item label={t('panel.credentials.profile.providerLabel')}>
                <Select
                value={repoProfileProvider}
                placeholder={t('panel.credentials.profile.providerPlaceholder')}
                options={[
                    { value: 'gitlab', label: providerLabel('gitlab') },
                    { value: 'github', label: providerLabel('github') }
                ]}
                onChange={(value) => setRepoProfileProvider(value as ProviderKey)}
                disabled={Boolean(repoProfileEditing)}
                />
            </Form.Item>
            <Form.Item label={t('panel.credentials.profile.name')} name="remark" rules={[{ required: true, message: t('panel.validation.required') }]}>
                <Input placeholder={t('panel.credentials.profile.namePlaceholder')} />
            </Form.Item>
            <Form.Item label={t('panel.credentials.profile.cloneUsername')} name="cloneUsername">
                <Input placeholder={t('panel.credentials.profile.cloneUsernamePlaceholder')} />
            </Form.Item>

            <Form.Item label={t('panel.credentials.profile.token')}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {repoProfileEditing?.hasToken ? (
                    <Radio.Group value={repoProfileTokenMode} onChange={(e) => setRepoProfileTokenMode(e.target.value)}>
                    <Radio value="keep">{t('panel.credentials.profile.tokenKeep')}</Radio>
                    <Radio value="set">{t('panel.credentials.profile.tokenSet')}</Radio>
                    </Radio.Group>
                ) : (
                    <Typography.Text type="secondary">{t('panel.credentials.profile.tokenSetTip')}</Typography.Text>
                )}

                <Form.Item
                  name="token"
                  style={{ marginBottom: 0 }}
                  rules={[
                    {
                      required: repoProfileTokenMode === 'set',
                      whitespace: true,
                      message: t('panel.validation.required')
                    }
                  ]}
                >
                  <Input.Password
                    placeholder={t('panel.credentials.secretInputPlaceholder')}
                    disabled={repoProfileTokenMode !== 'set'}
                    autoComplete="new-password"
                  />
                </Form.Item>
                {/* Token hint: show provider-specific PAT guidance near the input. (Change record: 2026-01-15) */}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {repoProfileProvider === 'github'
                    ? t('panel.credentials.profile.tokenHelp.github')
                    : t('panel.credentials.profile.tokenHelp.gitlab')}
                </Typography.Text>
                </Space>
            </Form.Item>

            {/* Default credential selection lives in the list view, not inside the profile editor. (Change record: 2026-01-15) */}
            </Form>
        </Space>
      </Modal>

      <Modal
        title={modelProfileEditing ? t('panel.credentials.profile.editTitle') : t('panel.credentials.profile.addTitle')}
        open={modelProfileFormOpen}
        className="hc-dialog--compact" /* UX (2026-01-15): tighter padding + unified surface in dark mode for profile editors. */
        onCancel={() => {
          setModelProfileFormOpen(false);
          setModelProfileEditing(null);
        }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={modelProfileSubmitting}
        onOk={() => void submitModelProfileForm()}
        destroyOnHidden
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
          {/* Allow choosing model provider when creating profiles from the unified list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
          {/* UX (2026-01-15): Use default control sizing inside modals (avoid overly compact inputs). */}
          <Form form={modelProfileForm} layout="vertical" requiredMark={false} size="middle">
            <Form.Item label={t('panel.credentials.profile.providerLabel')}>
              <Select
                value={modelProfileProvider}
                placeholder={t('panel.credentials.profile.providerPlaceholder')}
                options={[
                  { value: 'codex', label: modelProviderLabel('codex', t) },
                  { value: 'claude_code', label: modelProviderLabel('claude_code', t) },
                  { value: 'gemini_cli', label: modelProviderLabel('gemini_cli', t) }
                ]}
                onChange={(value) => setModelProfileProvider(value as ModelProviderKey)}
                disabled={Boolean(modelProfileEditing)}
              />
            </Form.Item>
            <Form.Item label={t('panel.credentials.profile.name')} name="remark" rules={[{ required: true, message: t('panel.validation.required') }]}>
              <Input placeholder={t('panel.credentials.profile.namePlaceholder')} />
            </Form.Item>

            <Form.Item
              label={
                modelProfileProvider === 'codex'
                  ? t('panel.credentials.codexApiKey')
                  : modelProfileProvider === 'claude_code'
                    ? t('panel.credentials.claudeCodeApiKey')
                    : t('panel.credentials.geminiCliApiKey')
              }
            >
              <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {modelProfileEditing?.hasApiKey ? (
                  <Radio.Group value={modelProfileApiKeyMode} onChange={(e) => setModelProfileApiKeyMode(e.target.value)}>
                    <Radio value="keep">{t('panel.credentials.profile.tokenKeep')}</Radio>
                    <Radio value="set">{t('panel.credentials.profile.tokenSet')}</Radio>
                  </Radio.Group>
                ) : (
                  <Typography.Text type="secondary">{t('panel.credentials.profile.tokenSetTip')}</Typography.Text>
                )}

                <Form.Item
                  name="apiKey"
                  style={{ marginBottom: 0 }}
                  rules={[
                    {
                      required: modelProfileApiKeyMode === 'set',
                      whitespace: true,
                      message: t('panel.validation.required')
                    }
                  ]}
                >
                  <Input.Password
                    placeholder={t('panel.credentials.secretInputPlaceholder')}
                    disabled={modelProfileApiKeyMode !== 'set'}
                    autoComplete="new-password"
                  />
                </Form.Item>
              </Space>
            </Form.Item>

            {/* UX: keep "API Base URL" below the secret input to match user expectations for proxy settings. */}
            <Form.Item label={t('panel.credentials.codexApiBaseUrl')} name="apiBaseUrl">
              <Input placeholder={t('panel.credentials.codexApiBaseUrlPlaceholder')} />
            </Form.Item>

            <Form.Item label={t('modelCatalog.title')}>
              <ModelProviderModelsButton
                disabled={savingCred || !canUseAccountApis}
                buttonProps={{ size: 'small' }}
                loadModels={async ({ forceRefresh }) => {
                  // Fetch models using either the stored key (keep mode) or the form input (set mode). b8fucnmey62u0muyn7i0
                  const apiBaseUrl = String(modelProfileForm.getFieldValue('apiBaseUrl') ?? '').trim();
                  const apiKey =
                    modelProfileApiKeyMode === 'set' ? String(modelProfileForm.getFieldValue('apiKey') ?? '').trim() : '';
                  const profileId = modelProfileApiKeyMode === 'keep' ? modelProfileEditing?.id : undefined;

                  return listMyModelProviderModels({
                    provider: modelProfileProvider,
                    profileId: profileId || undefined,
                    credential: {
                      apiBaseUrl: apiBaseUrl || null,
                      apiKey: apiKey || null
                    },
                    forceRefresh
                  });
                }}
              />
            </Form.Item>

            {/* Default credential selection lives in the list view, not inside the profile editor. (Change record: 2026-01-15) */}
          </Form>
        </Space>
      </Modal>
    </div>
  );

	  return (
	    <div className="hc-user-trigger">
	      <Button size="middle" icon={<UserOutlined />} aria-label={t('panel.trigger')} onClick={() => setOpen(true)}>
	        <span className="hc-user-trigger__label">{t('panel.trigger')}</span>
	      </Button>

	      <Modal
	        centered={!isCompactScreen}
	        open={open}
	        onCancel={closePanel}
	        footer={null}
	        destroyOnHidden
	        className={`hc-user-modal${isCompactScreen ? ' hc-user-modal--mobile' : ''}`}
	        width={isCompactScreen ? '100vw' : 920}
	        closeIcon={null} /* Custom close button in header */
	        style={{
	          maxWidth: isCompactScreen ? '100vw' : '95vw',
	          margin: isCompactScreen ? 0 : undefined,
	          top: isCompactScreen ? 0 : 20,
	          paddingBottom: isCompactScreen ? 0 : undefined
	        }}
	        styles={{
	            mask: {
	                backdropFilter: 'blur(10px)',
	                WebkitBackdropFilter: 'blur(10px)',
	                backgroundColor: 'rgba(0, 0, 0, 0.55)'
	            }
	        }}
	      >
	        {content}
	      </Modal>
	    </div>
	  );
	};

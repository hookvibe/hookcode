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
  fetchMe,
  fetchMyModelCredentials,
  updateMe,
  updateMyModelCredentials,
  type UserModelCredentialsPublic,
  type UserRepoProviderCredentialProfilePublic
} from '../api';
import { clearAuth, getStoredUser, getToken, setStoredUser, type AuthUser } from '../auth';
import { setLocale, useLocale, useT } from '../i18n';

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
 */

type ThemePreference = 'system' | 'light' | 'dark';
type ProviderKey = 'gitlab' | 'github';
type PanelTab = 'account' | 'credentials' | 'tools' | 'settings';

const DEFAULT_PORTS = { prisma: 7215, swagger: 7216 } as const;

const providerLabel = (provider: ProviderKey) => (provider === 'github' ? 'GitHub' : 'GitLab');

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

const normalizeProfiles = (value: unknown): UserRepoProviderCredentialProfilePublic[] =>
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
  const [changingCodexApiKey, setChangingCodexApiKey] = useState(false);
  const [changingClaudeCodeApiKey, setChangingClaudeCodeApiKey] = useState(false);
  const [changingGeminiCliApiKey, setChangingGeminiCliApiKey] = useState(false);
  const [savingCred, setSavingCred] = useState(false);

  const [toolsPorts, setToolsPorts] = useState(DEFAULT_PORTS);
  const [toolsLoading, setToolsLoading] = useState(false);

  const [profileFormOpen, setProfileFormOpen] = useState(false);
  const [profileProvider, setProfileProvider] = useState<ProviderKey>('gitlab');
  const [profileEditing, setProfileEditing] = useState<UserRepoProviderCredentialProfilePublic | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileForm] = Form.useForm<{ name: string; token?: string; cloneUsername?: string }>();

  const [profileFormTokenMode, setProfileFormTokenMode] = useState<'keep' | 'set'>('keep');

  const [profileFormProviderDefault, setProfileFormProviderDefault] = useState<string | null>(null);

  const [displayNameForm] = Form.useForm<{ displayName: string }>();
  const [passwordForm] = Form.useForm<{ currentPassword: string; newPassword: string; confirm: string }>();
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const token = getToken();
  const canUseAccountApis = Boolean(token);

  const tabTitleKey = useMemo(
    () =>
      ({
        account: 'panel.tabs.account',
        credentials: 'panel.tabs.credentials',
        tools: 'panel.tabs.tools',
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
      setChangingCodexApiKey(false);
      setChangingClaudeCodeApiKey(false);
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

  useEffect(() => {
    if (!open) return;
    void refreshUser();
    if (activeTab === 'credentials') void refreshCredentials();
    if (activeTab === 'tools') void refreshToolsMeta();
  }, [activeTab, open, refreshCredentials, refreshToolsMeta, refreshUser]);

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
    return false;
  }, [activeTab, canUseAccountApis, credLoading, toolsLoading, userLoading]);

  const refreshActiveTab = useCallback(async () => {
    if (!canUseAccountApis) return;
    // UX: keep refresh contextual so we avoid multiple concurrent API calls.
    if (activeTab === 'account') await refreshUser();
    if (activeTab === 'credentials') await refreshCredentials();
    if (activeTab === 'tools') await refreshToolsMeta();
  }, [activeTab, canUseAccountApis, refreshCredentials, refreshToolsMeta, refreshUser]);

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

  const codex = credentials?.codex ?? { hasApiKey: false };
  const codexHasApiKey = Boolean(codex.hasApiKey);
  const claudeCode = credentials?.claude_code ?? { hasApiKey: false };
  const claudeCodeHasApiKey = Boolean(claudeCode.hasApiKey);
  const geminiCli = credentials?.gemini_cli ?? { hasApiKey: false };
  const geminiCliHasApiKey = Boolean(geminiCli.hasApiKey);

  const saveCodex = useCallback(
    async (values: { apiBaseUrl?: string; apiKey?: string }) => {
      if (savingCred) return;
      setSavingCred(true);
      try {
        const apiBaseUrl = (values.apiBaseUrl ?? '').trim();
        const apiKey = (values.apiKey ?? '').trim();
        const shouldSendApiKey = !codexHasApiKey || changingCodexApiKey;
        const next = await updateMyModelCredentials({
          codex: {
            apiBaseUrl: apiBaseUrl ? apiBaseUrl : null,
            ...(shouldSendApiKey ? { apiKey: apiKey ? apiKey : null } : {})
          }
        });
        setCredentials(next);
        setChangingCodexApiKey(false);
        message.success(t('toast.credentials.saved'));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      } finally {
        setSavingCred(false);
      }
    },
    [changingCodexApiKey, codexHasApiKey, message, savingCred, t]
  );

  const saveClaudeCode = useCallback(
    async (values: { apiKey?: string }) => {
      if (savingCred) return;
      setSavingCred(true);
      try {
        const apiKey = (values.apiKey ?? '').trim();
        const shouldSendApiKey = !claudeCodeHasApiKey || changingClaudeCodeApiKey;
        const next = await updateMyModelCredentials({
          claude_code: {
            ...(shouldSendApiKey ? { apiKey: apiKey ? apiKey : null } : {})
          }
        });
        setCredentials(next);
        setChangingClaudeCodeApiKey(false);
        message.success(t('toast.credentials.saved'));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      } finally {
        setSavingCred(false);
      }
    },
    [changingClaudeCodeApiKey, claudeCodeHasApiKey, message, savingCred, t]
  );

  const saveGeminiCli = useCallback(
    async (values: { apiKey?: string }) => {
      if (savingCred) return;
      setSavingCred(true);
      try {
        const apiKey = (values.apiKey ?? '').trim();
        const shouldSendApiKey = !geminiCliHasApiKey || changingGeminiCliApiKey;
        const next = await updateMyModelCredentials({
          gemini_cli: {
            ...(shouldSendApiKey ? { apiKey: apiKey ? apiKey : null } : {})
          }
        });
        setCredentials(next);
        setChangingGeminiCliApiKey(false);
        message.success(t('toast.credentials.saved'));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      } finally {
        setSavingCred(false);
      }
    },
    [changingGeminiCliApiKey, geminiCliHasApiKey, message, savingCred, t]
  );

  const startEditProfile = useCallback(
    (provider: ProviderKey, profile?: UserRepoProviderCredentialProfilePublic | null) => {
      setProfileProvider(provider);
      setProfileEditing(profile ?? null);
      setProfileFormOpen(true);

      const initialName = profile?.name ?? '';
      const initialCloneUsername = profile?.cloneUsername ?? '';

      // UX: keep existing tokens by default (backend never returns raw tokens).
      setProfileFormTokenMode(profile?.hasToken ? 'keep' : 'set');
      profileForm.setFieldsValue({ name: initialName, cloneUsername: initialCloneUsername, token: '' });

      const providerCred = (credentials as any)?.[provider] ?? null;
      setProfileFormProviderDefault(providerCred?.defaultProfileId ?? null);
    },
    [credentials, profileForm]
  );

  const providerProfiles = useMemo(() => {
    const gitlabProfiles = normalizeProfiles(credentials?.gitlab?.profiles);
    const githubProfiles = normalizeProfiles(credentials?.github?.profiles);
    return { gitlab: gitlabProfiles, github: githubProfiles };
  }, [credentials?.github?.profiles, credentials?.gitlab?.profiles]);

  const setProviderDefault = useCallback(
    async (provider: ProviderKey, nextDefaultId: string | null) => {
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
    async (provider: ProviderKey, id: string) => {
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

  const submitProfileForm = useCallback(async () => {
    if (profileSubmitting) return;
    const values = await profileForm.validateFields();
    setProfileSubmitting(true);
    try {
      const name = String(values.name ?? '').trim();
      const cloneUsername = String(values.cloneUsername ?? '').trim();
      const tokenValue = String(values.token ?? '').trim();
      const shouldSendToken = profileFormTokenMode === 'set';

      const payload = {
        id: profileEditing?.id,
        name: name || null,
        cloneUsername: cloneUsername || null,
        ...(shouldSendToken ? { token: tokenValue ? tokenValue : null } : {})
      };

      const next = await updateMyModelCredentials({
        [profileProvider]: {
          profiles: [payload],
          defaultProfileId: profileFormProviderDefault || null
        }
      } as any);

      setCredentials(next);
      setProfileFormOpen(false);
      setProfileEditing(null);
      message.success(t('toast.credentials.saved'));
    } catch (err: any) {
      if (err?.errorFields) {
        // Form validation error; no toast.
      } else {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.credentials.saveFailed'));
      }
    } finally {
      setProfileSubmitting(false);
    }
  }, [
    message,
    profileEditing?.id,
    profileForm,
    profileFormProviderDefault,
    profileFormTokenMode,
    profileProvider,
    profileSubmitting,
    t
  ]);

  const saveDisplayName = useCallback(async () => {
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
  }, [displayNameForm, message, savingProfile, t, user]);

  const savePassword = useCallback(async () => {
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
  }, [message, passwordForm, savingPassword, t]);

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
              <Form form={displayNameForm} layout="vertical" requiredMark={false} size="small">
                <Form.Item label={t('panel.account.displayName')} name="displayName">
                  <Input placeholder={t('panel.account.displayNamePlaceholder')} />
                </Form.Item>
                <Button
                  type="primary"
                  size="small"
                  icon={<SettingOutlined />}
                  onClick={() => void saveDisplayName()}
                  loading={savingProfile}
                  disabled={!canUseAccountApis}
                >
                  {t('common.save')}
                </Button>
              </Form>
            </div>

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.account.passwordTitle')}</div>
              <Form form={passwordForm} layout="vertical" requiredMark={false} size="small">
                <Form.Item
                  label={t('panel.account.currentPassword')}
                  name="currentPassword"
                  rules={[{ required: true, message: t('panel.validation.required') }]}
                >
                  <Input.Password prefix={<LockOutlined />} autoComplete="current-password" />
                </Form.Item>
                <Form.Item
                  label={t('panel.account.newPassword')}
                  name="newPassword"
                  rules={[{ required: true, message: t('panel.validation.required') }, { min: 6, message: t('panel.validation.passwordTooShort') }]}
                >
                  <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
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
                  <Input.Password prefix={<LockOutlined />} autoComplete="new-password" />
                </Form.Item>
                <Button
                  type="primary"
                  size="small"
                  icon={<KeyOutlined />}
                  onClick={() => void savePassword()}
                  loading={savingPassword}
                  disabled={!canUseAccountApis}
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
              <div className="hc-settings-section-title">{t('panel.credentials.codexTitle')}</div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 10 }}>
                {t('panel.credentials.codexTip')}
              </Typography.Paragraph>
              <Form
                layout="vertical"
                requiredMark={false}
                size="small"
                initialValues={{ apiBaseUrl: codex.apiBaseUrl ?? '', apiKey: '' }}
                onFinish={(values) => void saveCodex(values as any)}
              >
                <Form.Item label={t('panel.credentials.codexApiBaseUrl')} name="apiBaseUrl">
                  <Input placeholder={t('panel.credentials.codexApiBaseUrlPlaceholder')} />
                </Form.Item>
                <Form.Item
                  label={t('panel.credentials.codexApiKey')}
                  name="apiKey"
                  rules={[
                    { required: !codexHasApiKey || changingCodexApiKey, whitespace: true, message: t('panel.validation.required') }
                  ]}
                  extra={
                    codexHasApiKey ? (
                      <Button type="link" size="small" style={{ padding: 0 }} onClick={() => setChangingCodexApiKey((v) => !v)}>
                        {changingCodexApiKey ? t('common.cancel') : t('panel.credentials.changeSecret')}
                      </Button>
                    ) : undefined
                  }
                >
                  <Input.Password
                    placeholder={
                      codexHasApiKey && !changingCodexApiKey
                        ? t('panel.credentials.secretConfiguredPlaceholder')
                        : t('panel.credentials.secretInputPlaceholder')
                    }
                    disabled={codexHasApiKey && !changingCodexApiKey}
                    autoComplete="new-password"
                  />
                </Form.Item>
                <Space size={8} wrap>
                  <Tag color={codexHasApiKey ? 'green' : 'default'}>
                    {codexHasApiKey ? t('common.configured') : t('common.notConfigured')}
                  </Tag>
                  <Button
                    type="primary"
                    size="small"
                    htmlType="submit"
                    loading={savingCred}
                    icon={<SettingOutlined />}
                    disabled={!canUseAccountApis}
                  >
                    {t('common.save')}
                  </Button>
                </Space>
              </Form>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.credentials.claudeCodeTitle')}</div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 10 }}>
                {t('panel.credentials.claudeCodeTip')}
              </Typography.Paragraph>
              <Form
                layout="vertical"
                requiredMark={false}
                size="small"
                initialValues={{ apiKey: '' }}
                onFinish={(values) => void saveClaudeCode(values as any)}
              >
                <Form.Item
                  label={t('panel.credentials.claudeCodeApiKey')}
                  name="apiKey"
                  rules={[
                    {
                      required: !claudeCodeHasApiKey || changingClaudeCodeApiKey,
                      whitespace: true,
                      message: t('panel.validation.required')
                    }
                  ]}
                  extra={
                    claudeCodeHasApiKey ? (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => setChangingClaudeCodeApiKey((v) => !v)}
                      >
                        {changingClaudeCodeApiKey ? t('common.cancel') : t('panel.credentials.changeSecret')}
                      </Button>
                    ) : undefined
                  }
                >
                  <Input.Password
                    placeholder={
                      claudeCodeHasApiKey && !changingClaudeCodeApiKey
                        ? t('panel.credentials.secretConfiguredPlaceholder')
                        : t('panel.credentials.secretInputPlaceholder')
                    }
                    disabled={claudeCodeHasApiKey && !changingClaudeCodeApiKey}
                    autoComplete="new-password"
                  />
                </Form.Item>
                <Space size={8} wrap>
                  <Tag color={claudeCodeHasApiKey ? 'green' : 'default'}>
                    {claudeCodeHasApiKey ? t('common.configured') : t('common.notConfigured')}
                  </Tag>
                  <Button
                    type="primary"
                    size="small"
                    htmlType="submit"
                    loading={savingCred}
                    icon={<SettingOutlined />}
                    disabled={!canUseAccountApis}
                  >
                    {t('common.save')}
                  </Button>
                </Space>
              </Form>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.credentials.geminiCliTitle')}</div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 10 }}>
                {t('panel.credentials.geminiCliTip')}
              </Typography.Paragraph>
              <Form
                layout="vertical"
                requiredMark={false}
                size="small"
                initialValues={{ apiKey: '' }}
                onFinish={(values) => void saveGeminiCli(values as any)}
              >
                <Form.Item
                  label={t('panel.credentials.geminiCliApiKey')}
                  name="apiKey"
                  rules={[
                    {
                      required: !geminiCliHasApiKey || changingGeminiCliApiKey,
                      whitespace: true,
                      message: t('panel.validation.required')
                    }
                  ]}
                  extra={
                    geminiCliHasApiKey ? (
                      <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => setChangingGeminiCliApiKey((v) => !v)}
                      >
                        {changingGeminiCliApiKey ? t('common.cancel') : t('panel.credentials.changeSecret')}
                      </Button>
                    ) : undefined
                  }
                >
                  <Input.Password
                    placeholder={
                      geminiCliHasApiKey && !changingGeminiCliApiKey
                        ? t('panel.credentials.secretConfiguredPlaceholder')
                        : t('panel.credentials.secretInputPlaceholder')
                    }
                    disabled={geminiCliHasApiKey && !changingGeminiCliApiKey}
                    autoComplete="new-password"
                  />
                </Form.Item>
                <Space size={8} wrap>
                  <Tag color={geminiCliHasApiKey ? 'green' : 'default'}>
                    {geminiCliHasApiKey ? t('common.configured') : t('common.notConfigured')}
                  </Tag>
                  <Button
                    type="primary"
                    size="small"
                    htmlType="submit"
                    loading={savingCred}
                    icon={<SettingOutlined />}
                    disabled={!canUseAccountApis}
                  >
                    {t('common.save')}
                  </Button>
                </Space>
              </Form>
            </div>

            <Divider style={{ margin: '14px 0' }} />

            <div className="hc-settings-section">
              <div className="hc-settings-section-title">{t('panel.credentials.repoTitle')}</div>
              <Space orientation="vertical" size={14} style={{ width: '100%' }}>
                {(['gitlab', 'github'] as ProviderKey[]).map((provider) => {
                  const profiles = providerProfiles[provider];
                  const defaultId = (credentials as any)?.[provider]?.defaultProfileId ?? null;
                  return (
                    <Card
                      key={provider}
                      size="small"
                      title={
                        <Space size={8}>
                          <GlobalOutlined />
                          <span>{providerLabel(provider)}</span>
                        </Space>
                      }
                      extra={
                        <Button size="small" onClick={() => startEditProfile(provider, null)}>
                          {t('panel.credentials.profile.add')}
                        </Button>
                      }
                    >
                      <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                        <div>
                          <Typography.Text type="secondary">{t('panel.credentials.profile.default')}</Typography.Text>
                          <div style={{ marginTop: 6 }}>
                            <Select
                              value={defaultId || undefined}
                              style={{ width: '100%' }}
                              placeholder={t('panel.credentials.profile.defaultPlaceholder')}
                              onChange={(value) => void setProviderDefault(provider, value ? String(value) : null)}
                              options={profiles.map((p) => ({ value: p.id, label: p.name || p.id }))}
                              allowClear
                              disabled={savingCred || !canUseAccountApis}
                            />
                          </div>
                        </div>

                        {profiles.length ? (
                          <Space orientation="vertical" size={6} style={{ width: '100%' }}>
                            {profiles.map((p) => (
                              <Card key={p.id} size="small" className="hc-inner-card" styles={{ body: { padding: 8 } }}>
                                <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                  <Space size={8} wrap>
                                    <Typography.Text strong>{p.name || p.id}</Typography.Text>
                                    {defaultId === p.id ? <Tag color="blue">{t('panel.credentials.profile.defaultTag')}</Tag> : null}
                                    <Tag color={p.hasToken ? 'green' : 'default'}>
                                      {p.hasToken ? t('common.configured') : t('common.notConfigured')}
                                    </Tag>
                                  </Space>
                                  <Typography.Text type="secondary">{p.cloneUsername || '-'}</Typography.Text>
                                </Space>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                  <Button size="small" onClick={() => startEditProfile(provider, p)}>
                                    {t('common.manage')}
                                  </Button>
                                  <Button size="small" danger onClick={() => void removeProfile(provider, p.id)} disabled={!canUseAccountApis}>
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
                  );
                })}
              </Space>
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
                <Select
                  value={locale}
                  style={{ width: 240 }}
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
                <Select
                    value={accentPreset}
                    style={{ width: '100%', maxWidth: 320 }}
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
        title={profileEditing ? t('panel.credentials.profile.editTitle') : t('panel.credentials.profile.addTitle')}
        open={profileFormOpen}
        onCancel={() => {
            setProfileFormOpen(false);
            setProfileEditing(null);
        }}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={profileSubmitting}
        onOk={() => void submitProfileForm()}
        destroyOnHidden
      >
        <Space orientation="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text type="secondary">{t('panel.credentials.profile.providerHint', { provider: providerLabel(profileProvider) })}</Typography.Text>
            <Form form={profileForm} layout="vertical" requiredMark={false} size="small">
            <Form.Item label={t('panel.credentials.profile.name')} name="name" rules={[{ required: true, message: t('panel.validation.required') }]}>
                <Input />
            </Form.Item>
            <Form.Item label={t('panel.credentials.profile.cloneUsername')} name="cloneUsername">
                <Input placeholder={t('panel.credentials.profile.cloneUsernamePlaceholder')} />
            </Form.Item>

            <Form.Item label={t('panel.credentials.profile.token')}>
                <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                {profileEditing?.hasToken ? (
                    <Radio.Group value={profileFormTokenMode} onChange={(e) => setProfileFormTokenMode(e.target.value)}>
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
                        required: profileFormTokenMode === 'set',
                        whitespace: true,
                        message: t('panel.validation.required')
                    }
                    ]}
                >
                    <Input.Password disabled={profileFormTokenMode !== 'set'} autoComplete="new-password" />
                </Form.Item>
                </Space>
            </Form.Item>

            <Form.Item label={t('panel.credentials.profile.default')} style={{ marginBottom: 0 }}>
                <Select
                    value={profileFormProviderDefault || undefined}
                    style={{ width: '100%' }}
                    placeholder={t('panel.credentials.profile.defaultPlaceholder')}
                    allowClear
                    onChange={(value) => setProfileFormProviderDefault(value ? String(value) : null)}
                    options={providerProfiles[profileProvider].map((p) => ({ value: p.id, label: p.name || p.id }))}
                />
            </Form.Item>
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

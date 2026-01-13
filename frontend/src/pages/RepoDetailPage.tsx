import { FC, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Typography
} from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type {
  CodexRobotProviderConfigPublic,
  ClaudeCodeRobotProviderConfigPublic,
  GeminiCliRobotProviderConfigPublic,
  ModelProvider,
  RepoAutomationConfig,
  RepoRobot,
  RepoScopedCredentialsPublic,
  Repository,
  UserModelCredentialsPublic
} from '../api';
import {
  createRepoRobot,
  deleteRepoRobot,
  fetchMyModelCredentials,
  fetchRepo,
  testRepoRobot,
  updateRepo,
  updateRepoAutomation,
  updateRepoRobot
} from '../api';
import { supportedLocales, useLocale, useT } from '../i18n';
import { buildReposHash, buildTaskHash } from '../router';
import { getPrevHashForBack, isInAppHash } from '../navHistory';
import { RepoAutomationPanel } from '../components/repoAutomation/RepoAutomationPanel';
import { RepoBranchesCard } from '../components/repos/RepoBranchesCard';
import { RepoWebhookDeliveriesPanel } from '../components/repos/RepoWebhookDeliveriesPanel';
import { WebhookIntroModal } from '../components/repos/WebhookIntroModal';
import { ResponsiveDialog } from '../components/dialogs/ResponsiveDialog';
import { TemplateEditor } from '../components/TemplateEditor';
import { ScrollableTable } from '../components/ScrollableTable';
import { PageNav } from '../components/nav/PageNav';

/**
 * RepoDetailPage:
 * - Business context: manage a repository connection (metadata, robots, automation, and webhook troubleshooting).
 * - Module: `frontend-chat` migration (Repo management).
 *
 * Key behaviors:
 * - Edit basic repo info (name/externalId/apiBaseUrl/enabled).
 * - Configure repo-scoped credentials (repo provider token + model provider API keys: codex / claude_code / gemini_cli).
 * - Manage robots (create/edit/test/enable/delete).
 * - Edit automation config with auto-save.
 * - Inspect webhook deliveries.
 *
 * Important constraints:
 * - Robot + automation operations require `repo.webhookVerifiedAt` (backend enforces this with 409/REPO_WEBHOOK_NOT_VERIFIED).
 *
 * Change record:
 * - 2026-01-12: Expanded the initial `frontend-chat` stub into a feature-complete migration from legacy `frontend`.
 * - 2026-01-12: Remove header refresh button to keep the PageNav actions minimal (content uses auto-refresh where needed).
 * - 2026-01-12: Move header save button into the corresponding tab content (avoid global actions in PageNav).
 * - 2026-01-13: Added Claude Code (`claude_code`) model provider support for repo-scoped credentials and robot configuration.
 * - 2026-01-13: Added Gemini CLI (`gemini_cli`) model provider support for repo-scoped credentials and robot configuration.
 */

export interface RepoDetailPageProps {
  repoId: string;
  userPanel?: ReactNode;
}

type RepoTabKey = 'basic' | 'branches' | 'credentials' | 'robots' | 'automation' | 'webhooks';

type RobotFormValues = {
  name: string;
  repoCredentialSource: 'user' | 'repo' | 'robot';
  repoCredentialProfileId?: string | null;
  token?: string;
  cloneUsername?: string;
  promptDefault?: string;
  language: string;
  defaultBranch?: string | null;
  isDefault: boolean;
  modelProvider: ModelProvider;
  modelProviderConfig: Partial<CodexRobotProviderConfigPublic | ClaudeCodeRobotProviderConfigPublic | GeminiCliRobotProviderConfigPublic> & {
    credentialSource?: 'user' | 'repo' | 'robot';
    credential?: { apiBaseUrl?: string; apiKey?: string; hasApiKey?: boolean };
    sandbox_workspace_write?: { network_access?: boolean };
  };
};

const providerLabel = (provider: string) => (provider === 'github' ? 'GitHub' : 'GitLab');

const parseHashQuery = (hash: string): URLSearchParams => {
  const idx = hash.indexOf('?');
  if (idx < 0) return new URLSearchParams();
  return new URLSearchParams(hash.slice(idx + 1));
};

const normalizeCredentialSource = (value: unknown): 'user' | 'repo' | 'robot' => {
  const v = String(value ?? '').trim();
  if (v === 'repo' || v === 'robot') return v;
  return 'user';
};

const normalizeCodexSandbox = (value: unknown): 'read-only' | 'workspace-write' => {
  const v = String(value ?? '').trim();
  return v === 'workspace-write' ? 'workspace-write' : 'read-only';
};

const normalizeCodexReasoningEffort = (value: unknown): 'low' | 'medium' | 'high' | 'xhigh' => {
  const v = String(value ?? '').trim();
  if (v === 'low' || v === 'high' || v === 'xhigh') return v;
  return 'medium';
};

const defaultAutomationConfig = (): RepoAutomationConfig => ({
  version: 2,
  events: {}
});

const resolveRobotStatusTag = (t: ReturnType<typeof useT>, robot: RepoRobot) => {
  if (robot.enabled) return <Tag color="green">{t('common.enabled')}</Tag>;
  if (robot.activatedAt) return <Tag color="red">{t('common.disabled')}</Tag>;
  return <Tag color="gold">{t('repos.robots.status.pending')}</Tag>;
};

export const RepoDetailPage: FC<RepoDetailPageProps> = ({ repoId, userPanel }) => {
  const locale = useLocale();
  const t = useT();
  const { message } = App.useApp();

  const currentHash = typeof window === 'undefined' ? '' : String(window.location.hash ?? '');
  const { fromTaskId, fromRobotId } = useMemo(() => {
    const params = parseHashQuery(currentHash);
    if (params.get('from') !== 'task') return { fromTaskId: '', fromRobotId: '' };
    return {
      fromTaskId: String(params.get('taskId') ?? '').trim(),
      fromRobotId: String(params.get('robotId') ?? '').trim()
    };
  }, [currentHash]);

  const [activeTab, setActiveTab] = useState<RepoTabKey>(() => (fromRobotId ? 'robots' : 'basic'));

  const [loading, setLoading] = useState(false);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [robots, setRobots] = useState<RepoRobot[]>([]);
  const [automationConfig, setAutomationConfig] = useState<RepoAutomationConfig | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookPathRaw, setWebhookPathRaw] = useState<string | null>(null);
  const [repoScopedCredentials, setRepoScopedCredentials] = useState<RepoScopedCredentialsPublic | null>(null);

  const [webhookIntroOpen, setWebhookIntroOpen] = useState(false);

  const [basicSaving, setBasicSaving] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [repoProviderChangingToken, setRepoProviderChangingToken] = useState(false);
  const [repoCodexChangingApiKey, setRepoCodexChangingApiKey] = useState(false);
  const [repoClaudeCodeChangingApiKey, setRepoClaudeCodeChangingApiKey] = useState(false);
  const [repoGeminiCliChangingApiKey, setRepoGeminiCliChangingApiKey] = useState(false);

  const [robotModalOpen, setRobotModalOpen] = useState(false);
  const [robotSubmitting, setRobotSubmitting] = useState(false);
  const [editingRobot, setEditingRobot] = useState<RepoRobot | null>(null);
  const [robotChangingToken, setRobotChangingToken] = useState(false);
  const [robotChangingModelApiKey, setRobotChangingModelApiKey] = useState(false);
  const [robotTestingId, setRobotTestingId] = useState<string | null>(null);
  const [robotTogglingId, setRobotTogglingId] = useState<string | null>(null);
  const [robotDeletingId, setRobotDeletingId] = useState<string | null>(null);

  const [userModelCredentials, setUserModelCredentials] = useState<UserModelCredentialsPublic | null>(null);
  const [userModelCredentialsLoading, setUserModelCredentialsLoading] = useState(false);
  const [userModelCredentialsError, setUserModelCredentialsError] = useState(false);

  const [basicForm] = Form.useForm<{ name: string; externalId?: string; apiBaseUrl?: string; enabled: boolean }>();
  const [credentialsForm] = Form.useForm<{
    repoToken?: string;
    cloneUsername?: string;
    codexApiBaseUrl?: string;
    codexApiKey?: string;
    claudeCodeApiKey?: string;
    geminiCliApiKey?: string;
  }>();
  const [robotForm] = Form.useForm<RobotFormValues>();

  const watchedRepoCredentialSource = Form.useWatch('repoCredentialSource', robotForm);
  const watchedRepoCredentialProfileId = Form.useWatch('repoCredentialProfileId', robotForm);

  const robotsSorted = useMemo(() => {
    const list = Array.isArray(robots) ? robots : [];
    return [...list].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
  }, [robots]);

  const webhookPath = useMemo(() => {
    if (!repo) return '';
    return webhookPathRaw || `/api/webhook/${repo.provider}/${repo.id}`;
  }, [repo, webhookPathRaw]);

  const webhookFullUrl = useMemo(() => {
    if (!webhookPath) return '';
    try {
      const rawApiBase = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api';
      const apiBase = typeof rawApiBase === 'string' && rawApiBase.trim() ? rawApiBase.trim() : '/api';
      const base = apiBase.startsWith('http') ? apiBase : new URL(apiBase, window.location.origin).toString();
      return new URL(webhookPath, base).toString();
    } catch {
      return webhookPath;
    }
  }, [webhookPath]);

  const webhookVerified = Boolean(repo?.webhookVerifiedAt);

  const title = useMemo(() => repo?.name || repoId || t('repos.detail.titleFallback'), [repo?.name, repoId, t]);

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

  const refresh = useCallback(async () => {
    if (!repoId) return;
    setLoading(true);
    try {
      const data = await fetchRepo(repoId);
      setRepo(data.repo);
      setRobots(Array.isArray(data.robots) ? data.robots : []);
      setAutomationConfig(data.automationConfig ?? null);
      setWebhookSecret(data.webhookSecret ?? null);
      setWebhookPathRaw(data.webhookPath ?? null);
      setRepoScopedCredentials(data.repoScopedCredentials ?? null);

      basicForm.setFieldsValue({
        name: data.repo?.name ?? '',
        externalId: data.repo?.externalId ?? '',
        apiBaseUrl: data.repo?.apiBaseUrl ?? '',
        enabled: Boolean(data.repo?.enabled)
      });

      // Credentials tab form: never prefill secrets; only show "configured" state from `repoScopedCredentials`.
      credentialsForm.setFieldsValue({
        repoToken: '',
        cloneUsername: data.repoScopedCredentials?.repoProvider?.cloneUsername ?? '',
        codexApiBaseUrl: data.repoScopedCredentials?.modelProvider?.codex?.apiBaseUrl ?? '',
        codexApiKey: '',
        claudeCodeApiKey: '',
        geminiCliApiKey: ''
      });
      setRepoProviderChangingToken(false);
      setRepoCodexChangingApiKey(false);
      setRepoClaudeCodeChangingApiKey(false);
      setRepoGeminiCliChangingApiKey(false);
    } catch (err) {
      console.error(err);
      message.error(t('toast.repos.detailFetchFailed'));
      setRepo(null);
      setRobots([]);
      setAutomationConfig(null);
      setWebhookSecret(null);
      setWebhookPathRaw(null);
      setRepoScopedCredentials(null);
    } finally {
      setLoading(false);
    }
  }, [basicForm, credentialsForm, message, repoId, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSaveBasic = useCallback(async () => {
    if (!repoId || basicSaving) return;
    const values = await basicForm.validateFields();
    setBasicSaving(true);
    try {
      await updateRepo(repoId, {
        name: values.name?.trim() || repo?.name || '',
        externalId: values.externalId?.trim() ? values.externalId.trim() : null,
        apiBaseUrl: values.apiBaseUrl?.trim() ? values.apiBaseUrl.trim() : null,
        enabled: Boolean(values.enabled)
      });
      message.success(t('toast.repos.saved'));
      await refresh();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
    } finally {
      setBasicSaving(false);
    }
  }, [basicForm, basicSaving, message, refresh, repo?.name, repoId, t]);

  const handleSaveCredentials = useCallback(async () => {
    if (!repoId || credentialsSaving) return;
    const values = await credentialsForm.validateFields();

    setCredentialsSaving(true);
    try {
      const repoTokenTrimmed = String(values.repoToken ?? '').trim();
      const codexApiKeyTrimmed = String(values.codexApiKey ?? '').trim();
      const claudeCodeApiKeyTrimmed = String(values.claudeCodeApiKey ?? '').trim();
      const geminiCliApiKeyTrimmed = String(values.geminiCliApiKey ?? '').trim();

      const repoProviderHasToken = Boolean(repoScopedCredentials?.repoProvider?.hasToken);
      const codexHasApiKey = Boolean(repoScopedCredentials?.modelProvider?.codex?.hasApiKey);
      const claudeCodeHasApiKey = Boolean(repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey);
      const geminiCliHasApiKey = Boolean(repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey);
      const shouldSendRepoToken = !repoProviderHasToken || repoProviderChangingToken;
      const shouldSendCodexApiKey = !codexHasApiKey || repoCodexChangingApiKey;
      const shouldSendClaudeCodeApiKey = !claudeCodeHasApiKey || repoClaudeCodeChangingApiKey;
      const shouldSendGeminiCliApiKey = !geminiCliHasApiKey || repoGeminiCliChangingApiKey;

      const repoProviderCredential = {
        cloneUsername: String(values.cloneUsername ?? '').trim() ? String(values.cloneUsername ?? '').trim() : null,
        ...(shouldSendRepoToken ? { token: repoTokenTrimmed || null } : {})
      };

      const modelProviderCredential = {
        codex: {
          apiBaseUrl: String(values.codexApiBaseUrl ?? '').trim() ? String(values.codexApiBaseUrl ?? '').trim() : null,
          ...(shouldSendCodexApiKey ? { apiKey: codexApiKeyTrimmed || null } : {})
        },
        // Change record: support storing multiple model-provider credentials side-by-side (codex + claude_code + gemini_cli).
        claude_code: {
          ...(shouldSendClaudeCodeApiKey ? { apiKey: claudeCodeApiKeyTrimmed || null } : {})
        },
        gemini_cli: {
          ...(shouldSendGeminiCliApiKey ? { apiKey: geminiCliApiKeyTrimmed || null } : {})
        }
      };

      await updateRepo(repoId, {
        repoProviderCredential,
        modelProviderCredential
      });

      message.success(t('toast.repos.saved'));
      await refresh();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
    } finally {
      setCredentialsSaving(false);
    }
  }, [
    credentialsForm,
    credentialsSaving,
    message,
    refresh,
    repoClaudeCodeChangingApiKey,
    repoCodexChangingApiKey,
    repoGeminiCliChangingApiKey,
    repoId,
    repoProviderChangingToken,
    repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey,
    repoScopedCredentials?.modelProvider?.codex?.hasApiKey,
    repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey,
    repoScopedCredentials?.repoProvider?.hasToken,
    t
  ]);

  useEffect(() => {
    if (!robotModalOpen) return;
    let cancelled = false;
    setUserModelCredentialsLoading(true);
    setUserModelCredentialsError(false);
    void (async () => {
      try {
        const credentials = await fetchMyModelCredentials();
        if (cancelled) return;
        setUserModelCredentials(credentials);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setUserModelCredentials(null);
          setUserModelCredentialsError(true);
        }
      } finally {
        if (!cancelled) setUserModelCredentialsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [robotModalOpen]);

  useEffect(() => {
    // UX: auto-pick a usable provider profile when users choose `repoCredentialSource=user`.
    if (!robotModalOpen) return;
    if (!repo?.provider) return;

    const source = watchedRepoCredentialSource === 'robot' ? 'robot' : watchedRepoCredentialSource === 'repo' ? 'repo' : 'user';
    const currentProfileId = typeof watchedRepoCredentialProfileId === 'string' ? watchedRepoCredentialProfileId.trim() : '';

    if (source !== 'user') {
      if (currentProfileId) {
        robotForm.setFieldsValue({ repoCredentialProfileId: null });
      }
      return;
    }

    const providerCredentials = repo.provider === 'github' ? userModelCredentials?.github : userModelCredentials?.gitlab;
    const profiles = providerCredentials?.profiles ?? [];
    const existing = currentProfileId ? profiles.find((p) => p.id === currentProfileId) ?? null : null;
    if (existing && existing.hasToken) return;

    const defaultId = String(providerCredentials?.defaultProfileId ?? '').trim();
    const defaultProfile = defaultId ? profiles.find((p) => p.id === defaultId) ?? null : null;
    const nextId = (defaultProfile && defaultProfile.hasToken ? defaultProfile.id : '') || (profiles.find((p) => p.hasToken)?.id ?? '');
    if (!nextId || nextId === currentProfileId) return;
    robotForm.setFieldsValue({ repoCredentialProfileId: nextId });
  }, [repo?.provider, robotForm, robotModalOpen, userModelCredentials?.gitlab, userModelCredentials?.github, watchedRepoCredentialProfileId, watchedRepoCredentialSource]);

  const buildRobotInitialValues = useCallback(
    (robot?: RepoRobot | null): RobotFormValues => {
      const buildDefaultModelProviderConfig = (provider: string): RobotFormValues['modelProviderConfig'] => {
        if (provider === 'claude_code') {
          return {
            credentialSource: 'user',
            model: 'claude-sonnet-4-5-20250929',
            sandbox: 'read-only',
            sandbox_workspace_write: { network_access: false }
          } as any;
        }
        if (provider === 'gemini_cli') {
          return {
            credentialSource: 'user',
            model: 'gemini-2.5-pro',
            sandbox: 'read-only',
            sandbox_workspace_write: { network_access: false }
          } as any;
        }
        return {
          credentialSource: 'user',
          model: 'gpt-5.2',
          sandbox: 'read-only',
          model_reasoning_effort: 'medium',
          sandbox_workspace_write: { network_access: false }
        } as any;
      };

      const base: RobotFormValues = {
        name: '',
        repoCredentialSource: 'robot',
        repoCredentialProfileId: null,
        token: '',
        cloneUsername: '',
        promptDefault: '',
        language: locale,
        defaultBranch: null,
        isDefault: false,
        modelProvider: 'codex',
        modelProviderConfig: buildDefaultModelProviderConfig('codex')
      };

      if (!robot) return base;

      const modelProvider = String(robot.modelProvider ?? 'codex').trim() || 'codex';
      const cfg = (robot.modelProviderConfig ?? {}) as any;
      const repoCredentialSource = robot.hasToken ? 'robot' : robot.repoCredentialProfileId ? 'user' : 'repo';
      const providerDefaults = buildDefaultModelProviderConfig(modelProvider);
      const credentialSource = normalizeCredentialSource(cfg?.credentialSource ?? providerDefaults.credentialSource);

      return {
        ...base,
        name: robot.name || robot.id,
        repoCredentialSource,
        repoCredentialProfileId: repoCredentialSource === 'user' ? robot.repoCredentialProfileId ?? null : null,
        token: '',
        cloneUsername: robot.cloneUsername ?? '',
        promptDefault: robot.promptDefault ?? '',
        language: typeof robot.language === 'string' && robot.language.trim() ? robot.language.trim() : locale,
        defaultBranch: robot.defaultBranch ?? null,
        isDefault: Boolean(robot.isDefault),
        modelProvider: modelProvider as any,
        modelProviderConfig: {
          credentialSource,
          credential:
            credentialSource === 'robot'
              ? {
                  apiKey: '',
                  hasApiKey: Boolean(cfg?.credential?.hasApiKey),
                  ...(modelProvider === 'codex' ? { apiBaseUrl: cfg?.credential?.apiBaseUrl ?? '' } : {})
                }
              : undefined,
          model: cfg?.model ?? providerDefaults.model,
          sandbox: cfg?.sandbox ?? providerDefaults.sandbox,
          ...(modelProvider === 'codex'
            ? { model_reasoning_effort: cfg?.model_reasoning_effort ?? (providerDefaults as any).model_reasoning_effort }
            : {}),
          sandbox_workspace_write: {
            network_access: Boolean(cfg?.sandbox_workspace_write?.network_access ?? providerDefaults?.sandbox_workspace_write?.network_access)
          }
        }
      };
    },
    [locale]
  );

  const openCreateRobot = useCallback(() => {
    setEditingRobot(null);
    setRobotChangingToken(false);
    setRobotChangingModelApiKey(false);
    setRobotModalOpen(true);
    robotForm.setFieldsValue(buildRobotInitialValues(null));
  }, [buildRobotInitialValues, robotForm]);

  const openEditRobot = useCallback(
    (robot: RepoRobot) => {
      setEditingRobot(robot);
      setRobotChangingToken(false);
      setRobotChangingModelApiKey(false);
      setRobotModalOpen(true);
      robotForm.setFieldsValue(buildRobotInitialValues(robot));
    },
    [buildRobotInitialValues, robotForm]
  );

  const handleSubmitRobot = useCallback(
    async (values: RobotFormValues) => {
      if (!repo) return;
      if (!webhookVerified) {
        message.warning(t('repos.webhookIntro.notVerified'));
        return;
      }

      setRobotSubmitting(true);
      try {
        const repoCredentialSource =
          values.repoCredentialSource === 'robot' ? 'robot' : values.repoCredentialSource === 'repo' ? 'repo' : 'user';
        const repoCredentialProfileId = typeof values.repoCredentialProfileId === 'string' ? values.repoCredentialProfileId.trim() : '';

        const shouldSendToken = repoCredentialSource !== 'robot' ? true : !editingRobot || !editingRobot.hasToken || robotChangingToken;
        const tokenValue = typeof values.token === 'string' && values.token.trim() ? values.token.trim() : null;

        const promptDefaultValue = typeof values.promptDefault === 'string' ? values.promptDefault.trim() : '';
        if (!promptDefaultValue) {
          message.warning(t('repos.robotForm.promptRequired'));
          return;
        }

        const modelProvider = values.modelProvider ?? 'codex';
        const cfg = (values.modelProviderConfig ?? {}) as any;
        const credentialSource = normalizeCredentialSource(cfg.credentialSource);
        const normalizedModelProvider = (() => {
          const raw = String(modelProvider ?? '').trim();
          if (raw === 'claude_code') return 'claude_code';
          if (raw === 'gemini_cli') return 'gemini_cli';
          return 'codex';
        })();
        const isCodex = normalizedModelProvider === 'codex';

        // Repo provider credential validation.
        if (repoCredentialSource === 'user') {
          if (!repoCredentialProfileId) {
            message.warning(t('repos.robotForm.repoCredential.profileRequired'));
            return;
          }
          const providerCredentials = repo.provider === 'github' ? userModelCredentials?.github : userModelCredentials?.gitlab;
          const profiles = providerCredentials?.profiles ?? [];
          const selected = profiles.find((p) => p.id === repoCredentialProfileId) ?? null;
          if (!selected) {
            message.warning(t('repos.robotForm.repoCredential.profileNotFound'));
            return;
          }
          if (!selected.hasToken) {
            message.warning(t('repos.robotForm.repoCredential.profileTokenMissing'));
            return;
          }
        } else if (repoCredentialSource === 'repo') {
          const hasRepoToken = Boolean(repoScopedCredentials?.repoProvider?.hasToken);
          if (!hasRepoToken) {
            message.warning(t('repos.robotForm.repoCredential.repoNotConfigured'));
            return;
          }
        } else if (repoCredentialSource === 'robot') {
          const needsToken = !editingRobot || !editingRobot.hasToken || robotChangingToken;
          if (needsToken && !tokenValue) {
            message.warning(t('repos.robotForm.repoCredential.tokenRequired'));
            return;
          }
        }

        // Model provider credential validation (codex / claude_code / gemini_cli).
        if (credentialSource === 'repo') {
          const hasRepoApiKey =
            normalizedModelProvider === 'codex'
              ? Boolean(repoScopedCredentials?.modelProvider?.codex?.hasApiKey)
              : normalizedModelProvider === 'claude_code'
                ? Boolean(repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey)
                : Boolean(repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey);
          if (!hasRepoApiKey) {
            const key =
              normalizedModelProvider === 'codex'
                ? 'repos.robotForm.modelCredential.repoNotConfigured'
                : normalizedModelProvider === 'claude_code'
                  ? 'repos.robotForm.modelCredential.repoNotConfigured.claude_code'
                  : 'repos.robotForm.modelCredential.repoNotConfigured.gemini_cli';
            message.warning(
              t(key)
            );
            return;
          }
        }

        if (credentialSource === 'user') {
          const hasUserApiKey =
            normalizedModelProvider === 'codex'
              ? Boolean(userModelCredentials?.codex?.hasApiKey)
              : normalizedModelProvider === 'claude_code'
                ? Boolean(userModelCredentials?.claude_code?.hasApiKey)
                : Boolean(userModelCredentials?.gemini_cli?.hasApiKey);
          if (!hasUserApiKey) {
            const key =
              normalizedModelProvider === 'codex'
                ? 'repos.robotForm.modelCredential.userNotConfigured'
                : normalizedModelProvider === 'claude_code'
                  ? 'repos.robotForm.modelCredential.userNotConfigured.claude_code'
                  : 'repos.robotForm.modelCredential.userNotConfigured.gemini_cli';
            message.warning(
              t(key)
            );
            return;
          }
        }

        const editingRobotHasApiKey = Boolean(
          editingRobot && String(editingRobot.modelProvider ?? '').trim() === normalizedModelProvider && (editingRobot.modelProviderConfig as any)?.credential?.hasApiKey
        );
        const apiBaseUrl =
          isCodex && credentialSource === 'robot' && typeof cfg?.credential?.apiBaseUrl === 'string'
            ? cfg.credential.apiBaseUrl.trim()
            : '';
        const apiKey =
          credentialSource === 'robot' && typeof cfg?.credential?.apiKey === 'string' ? cfg.credential.apiKey.trim() : '';
        const shouldSendModelApiKey =
          credentialSource === 'robot' && (!editingRobot || robotChangingModelApiKey || !editingRobotHasApiKey);

        const payload: any = {
          name: values.name,
          ...(shouldSendToken ? { token: repoCredentialSource === 'robot' ? tokenValue : null } : {}),
          cloneUsername: repoCredentialSource === 'robot' ? (values.cloneUsername?.trim() ? values.cloneUsername.trim() : null) : null,
          repoCredentialProfileId: repoCredentialSource === 'user' ? repoCredentialProfileId : null,
          promptDefault: promptDefaultValue,
          language: values.language?.trim() ? values.language.trim() : null,
          modelProvider: normalizedModelProvider,
          modelProviderConfig: isCodex
            ? {
                credentialSource,
                credential:
                  credentialSource === 'robot'
                    ? {
                        apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
                        ...(shouldSendModelApiKey ? { apiKey: apiKey ? apiKey : undefined } : {})
                      }
                    : undefined,
                model: cfg.model,
                sandbox: normalizeCodexSandbox(cfg.sandbox),
                model_reasoning_effort: normalizeCodexReasoningEffort(cfg.model_reasoning_effort),
                sandbox_workspace_write: { network_access: Boolean(cfg?.sandbox_workspace_write?.network_access) }
              }
            : {
                credentialSource,
                credential: credentialSource === 'robot' ? { ...(shouldSendModelApiKey ? { apiKey: apiKey ? apiKey : undefined } : {}) } : undefined,
                model: String(cfg.model ?? '').trim(),
                sandbox: normalizeCodexSandbox(cfg.sandbox),
                sandbox_workspace_write: { network_access: Boolean(cfg?.sandbox_workspace_write?.network_access) }
              },
          defaultBranch: values.defaultBranch === undefined ? undefined : values.defaultBranch,
          isDefault: values.isDefault
        };

        if (editingRobot) {
          const saved = await updateRepoRobot(repo.id, editingRobot.id, payload);
          setRobots((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        } else {
          const created = await createRepoRobot(repo.id, payload);
          setRobots((prev) => [...prev, created]);
        }

        message.success(t('toast.repos.saved'));
        setRobotModalOpen(false);
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
      } finally {
        setRobotSubmitting(false);
      }
    },
    [
      editingRobot,
      message,
      repo,
      repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey,
      repoScopedCredentials?.modelProvider?.codex?.hasApiKey,
      repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey,
      repoScopedCredentials?.repoProvider?.hasToken,
      robotChangingModelApiKey,
      robotChangingToken,
      t,
      userModelCredentials?.claude_code?.hasApiKey,
      userModelCredentials?.codex?.hasApiKey,
      userModelCredentials?.gemini_cli?.hasApiKey,
      userModelCredentials?.github,
      userModelCredentials?.gitlab,
      webhookVerified
    ]
  );

  const handleTestRobot = useCallback(
    async (robot: RepoRobot) => {
      if (!repo) return;
      if (!webhookVerified) {
        message.warning(t('repos.webhookIntro.notVerified'));
        return;
      }
      setRobotTestingId(robot.id);
      try {
        const result = await testRepoRobot(repo.id, robot.id);
        setRobots((prev) => prev.map((r) => (r.id === robot.id ? result.robot : r)));
        if (result.ok) {
          message.success(t('repos.robots.test.success'));
        } else {
          message.warning(result.message || t('repos.robots.test.failed'));
        }
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('repos.robots.test.failed'));
      } finally {
        setRobotTestingId(null);
      }
    },
    [message, repo, t, webhookVerified]
  );

  const handleToggleRobotEnabled = useCallback(
    async (robot: RepoRobot) => {
      if (!repo) return;
      if (!webhookVerified) {
        message.warning(t('repos.webhookIntro.notVerified'));
        return;
      }
      setRobotTogglingId(robot.id);
      try {
        const saved = await updateRepoRobot(repo.id, robot.id, { enabled: !robot.enabled });
        setRobots((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
        message.success(t('toast.repos.saved'));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
      } finally {
        setRobotTogglingId(null);
      }
    },
    [message, repo, t, webhookVerified]
  );

  const handleDeleteRobot = useCallback(
    async (robot: RepoRobot) => {
      if (!repo) return;
      if (!webhookVerified) {
        message.warning(t('repos.webhookIntro.notVerified'));
        return;
      }

      setRobotDeletingId(robot.id);
      try {
        await deleteRepoRobot(repo.id, robot.id);
        setRobots((prev) => prev.filter((r) => r.id !== robot.id));
        message.success(t('repos.robots.deleted'));
      } catch (err: any) {
        const code = String(err?.response?.data?.code ?? '').trim();
        if (code === 'ROBOT_IN_USE') {
          const usages = Array.isArray(err?.response?.data?.usages) ? err.response.data.usages : [];
          const hint =
            usages.length && usages[0]
              ? `${String(usages[0]?.eventKey ?? '')} · ${String(usages[0]?.ruleName ?? '')}`.trim()
              : '';
          message.error(hint ? t('repos.robots.deleteInUse', { hint }) : t('repos.robots.deleteInUseFallback'));
          return;
        }
        console.error(err);
        message.error(err?.response?.data?.error || t('repos.robots.deleteFailed'));
      } finally {
        setRobotDeletingId(null);
      }
    },
    [message, repo, t, webhookVerified]
  );

  const openedRobotIdRef = useRef<string>('');
  useEffect(() => {
    // UX: when opened from TaskDetail with `robotId`, auto-open the robot editor exactly once per `robotId`.
    if (!fromRobotId) {
      openedRobotIdRef.current = '';
      return;
    }
    if (openedRobotIdRef.current === fromRobotId) return;
    if (!robotsSorted.length) return;
    const target = robotsSorted.find((r) => r.id === fromRobotId);
    if (!target) return;
    openedRobotIdRef.current = fromRobotId;
    setActiveTab('robots');
    openEditRobot(target);
  }, [fromRobotId, openEditRobot, robotsSorted]);

  if (!repoId) {
    return (
      <div className="hc-page">
        <div className="hc-empty">
          <Empty description={t('repos.detail.missingId')} />
        </div>
      </div>
    );
  }

  // UX: keep PageNav actions minimal; tab-level actions (save/test/create) should live inside each tab.
  const headerActions = undefined;

  const headerBack = useMemo(() => {
    // Header back behavior:
    // - Module: Frontend Chat / Repos.
    // - Business intent: match legacy frontend "header back icon" rules:
    //   - If opened from TaskDetail via `?from=task&taskId=...`, go back to that task (prefer `history.back()` when safe).
    //   - Otherwise, prefer the previous in-app hash; fall back to `#/repos` when there is no safe history.
    // - Change record: 2026-01-12 - Add header back to repo detail and support task->repo deep-linking parity.
    if (typeof window === 'undefined') return undefined;

    if (fromTaskId) {
      const target = buildTaskHash(fromTaskId);
      return {
        ariaLabel: t('common.backToTaskDetail'),
        onClick: () => {
          const prevHash = String(getPrevHashForBack() ?? '');
          if (isInAppHash(prevHash) && prevHash === target) {
            window.history.back();
            return;
          }
          window.location.hash = target;
        }
      };
    }

    return {
      ariaLabel: t('common.backToList'),
      onClick: () => {
        const currentHash = String(window.location.hash ?? '');
        const prevHash = String(getPrevHashForBack() ?? '');
        if (isInAppHash(prevHash) && prevHash !== currentHash) {
          window.history.back();
          return;
        }
        window.location.hash = buildReposHash();
      }
    };
  }, [fromTaskId, t]);

  return (
    <>
      <div className="hc-page">
        <PageNav
          back={headerBack}
          title={title}
          meta={
            <Typography.Text type="secondary">
              {repo ? `${providerLabel(repo.provider)} · ${repo.id}` : repoId}
              {repo?.updatedAt ? ` · ${t('repos.detail.updatedAt', { time: formatTime(repo.updatedAt) })}` : ''}
              {repo?.webhookVerifiedAt ? ` · ${t('repos.webhookIntro.verifiedAt', { time: formatTime(repo.webhookVerifiedAt) })}` : ''}
            </Typography.Text>
          }
          actions={headerActions}
          userPanel={userPanel}
        />

        <div className="hc-page__body">
          {repo ? (
            <Space orientation="vertical" size={12} style={{ width: '100%' }}>
              {!webhookVerified ? (
                <Alert
                  type="warning"
                  showIcon
                  message={t('repos.webhookIntro.notVerified')}
                  description={t('repos.webhookIntro.notVerifiedDesc')}
                  action={
                    <Button size="small" onClick={() => setWebhookIntroOpen(true)}>
                      {t('repos.webhookIntro.open')}
                    </Button>
                  }
                />
              ) : null}

              <Tabs
                activeKey={activeTab}
                onChange={(key) => setActiveTab(key as RepoTabKey)}
                items={[
                  {
                    key: 'basic',
                    label: t('repos.detail.tabs.basic'),
                    children: (
                      <Card size="small" title={t('repos.detail.basicTitle')} className="hc-card">
                        <Form form={basicForm} layout="vertical" requiredMark={false}>
                          <Form.Item label={t('common.name')} name="name" rules={[{ required: true, message: t('repos.form.nameRequired') }]}>
                            <Input />
                          </Form.Item>
                          <Form.Item label={t('repos.detail.externalId')} name="externalId">
                            <Input placeholder={t('repos.detail.externalIdPlaceholder')} />
                          </Form.Item>
                          <Form.Item label={t('repos.detail.apiBaseUrl')} name="apiBaseUrl">
                            <Input placeholder={t('repos.detail.apiBaseUrlPlaceholder')} />
                          </Form.Item>
                          <Form.Item label={t('common.status')} name="enabled" valuePropName="checked">
                            <Switch checkedChildren={t('common.enabled')} unCheckedChildren={t('common.disabled')} />
                          </Form.Item>
                        </Form>
                        {fromTaskId ? (
                          <Typography.Paragraph type="secondary" style={{ marginTop: 10, marginBottom: 0 }}>
                            {t('repos.detail.openedFromTask', { taskId: fromTaskId })}
                          </Typography.Paragraph>
                        ) : null}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                          <Button
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => void handleSaveBasic()}
                            loading={basicSaving}
                            disabled={loading}
                          >
                            {t('common.save')}
                          </Button>
                        </div>
                      </Card>
                    )
                  },
                  {
                    key: 'branches',
                    label: t('repos.detail.tabs.branches'),
                    children: <RepoBranchesCard repo={repo} onSaved={(next) => setRepo(next)} readOnly={false} />
                  },
                  {
                    key: 'credentials',
                    label: t('repos.detail.tabs.credentials'),
                    children: (
                      <Card size="small" title={t('repos.detail.credentialsTitle')} className="hc-card">
                        <Form form={credentialsForm} layout="vertical" requiredMark={false}>
                          <Row gutter={16}>
                            <Col xs={24} md={12}>
                              <Typography.Text strong>{t('repos.detail.credentials.repoProvider')}</Typography.Text>
                              <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
                                {t('repos.detail.credentials.repoProviderTip')}
                              </Typography.Paragraph>
                              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                <Typography.Text type="secondary">
                                  {t('repos.detail.credentials.repoProviderStatus')}:{' '}
                                  <Tag color={repoScopedCredentials?.repoProvider?.hasToken ? 'green' : 'default'}>
                                    {repoScopedCredentials?.repoProvider?.hasToken ? t('common.configured') : t('common.notConfigured')}
                                  </Tag>
                                </Typography.Text>

                                <Form.Item label={t('repos.detail.credentials.cloneUsername')} name="cloneUsername">
                                  <Input placeholder={t('repos.detail.credentials.cloneUsernamePlaceholder')} />
                                </Form.Item>

                                <Form.Item
                                  label={t('repos.detail.credentials.repoToken')}
                                  name="repoToken"
                                  extra={
                                    repoScopedCredentials?.repoProvider?.hasToken ? (
                                      <Button
                                        type="link"
                                        size="small"
                                        style={{ padding: 0 }}
                                        onClick={() => {
                                          setRepoProviderChangingToken((v) => {
                                            const next = !v;
                                            if (!next) credentialsForm.setFieldsValue({ repoToken: '' });
                                            return next;
                                          });
                                        }}
                                      >
                                        {repoProviderChangingToken ? t('common.cancel') : t('panel.credentials.changeSecret')}
                                      </Button>
                                    ) : undefined
                                  }
                                >
                                  <Input.Password
                                    disabled={Boolean(repoScopedCredentials?.repoProvider?.hasToken) && !repoProviderChangingToken}
                                    placeholder={
                                      repoScopedCredentials?.repoProvider?.hasToken && !repoProviderChangingToken
                                        ? t('panel.credentials.secretConfiguredPlaceholder')
                                        : t('panel.credentials.secretInputPlaceholder')
                                    }
                                    autoComplete="new-password"
                                  />
                                </Form.Item>
                              </Space>
                            </Col>

                            <Col xs={24} md={12}>
                              <Typography.Text strong>{t('repos.detail.credentials.modelProvider')}</Typography.Text>
                              <Typography.Paragraph type="secondary" style={{ marginTop: 6 }}>
                                {t('repos.detail.credentials.modelProviderTip')}
                              </Typography.Paragraph>

                              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                                <div>
                                  <Typography.Text strong>{t('repos.robotForm.modelProvider.codex')}</Typography.Text>
                                  <div style={{ marginTop: 6 }}>
                                    <Typography.Text type="secondary">
                                      {t('repos.detail.credentials.modelProviderStatus')}:{' '}
                                      <Tag color={repoScopedCredentials?.modelProvider?.codex?.hasApiKey ? 'green' : 'default'}>
                                        {repoScopedCredentials?.modelProvider?.codex?.hasApiKey ? t('common.configured') : t('common.notConfigured')}
                                      </Tag>
                                    </Typography.Text>
                                  </div>
                                </div>

                                <Form.Item label={t('panel.credentials.codexApiBaseUrl')} name="codexApiBaseUrl">
                                  <Input placeholder={t('panel.credentials.codexApiBaseUrlPlaceholder')} />
                                </Form.Item>

                                <Form.Item
                                  label={t('panel.credentials.codexApiKey')}
                                  name="codexApiKey"
                                  extra={
                                    repoScopedCredentials?.modelProvider?.codex?.hasApiKey ? (
                                      <Button
                                        type="link"
                                        size="small"
                                        style={{ padding: 0 }}
                                        onClick={() => {
                                          setRepoCodexChangingApiKey((v) => {
                                            const next = !v;
                                            if (!next) credentialsForm.setFieldsValue({ codexApiKey: '' });
                                            return next;
                                          });
                                        }}
                                      >
                                        {repoCodexChangingApiKey ? t('common.cancel') : t('panel.credentials.changeSecret')}
                                      </Button>
                                    ) : undefined
                                  }
                                >
                                  <Input.Password
                                    disabled={Boolean(repoScopedCredentials?.modelProvider?.codex?.hasApiKey) && !repoCodexChangingApiKey}
                                    placeholder={
                                      repoScopedCredentials?.modelProvider?.codex?.hasApiKey && !repoCodexChangingApiKey
                                        ? t('panel.credentials.secretConfiguredPlaceholder')
                                        : t('panel.credentials.secretInputPlaceholder')
                                    }
                                    autoComplete="new-password"
                                  />
                                </Form.Item>

                                <Divider style={{ margin: '12px 0' }} />

                                <div>
                                  <Typography.Text strong>{t('repos.robotForm.modelProvider.claude_code')}</Typography.Text>
                                  <div style={{ marginTop: 6 }}>
                                    <Typography.Text type="secondary">
                                      {t('repos.detail.credentials.modelProviderStatus')}:{' '}
                                      <Tag color={repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey ? 'green' : 'default'}>
                                        {repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey ? t('common.configured') : t('common.notConfigured')}
                                      </Tag>
                                    </Typography.Text>
                                  </div>
                                </div>

                                <Form.Item
                                  label={t('panel.credentials.claudeCodeApiKey')}
                                  name="claudeCodeApiKey"
                                  extra={
                                    repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey ? (
                                      <Button
                                        type="link"
                                        size="small"
                                        style={{ padding: 0 }}
                                        onClick={() => {
                                          setRepoClaudeCodeChangingApiKey((v) => {
                                            const next = !v;
                                            if (!next) credentialsForm.setFieldsValue({ claudeCodeApiKey: '' });
                                            return next;
                                          });
                                        }}
                                      >
                                        {repoClaudeCodeChangingApiKey ? t('common.cancel') : t('panel.credentials.changeSecret')}
                                      </Button>
                                    ) : undefined
                                  }
                                >
                                  <Input.Password
                                    disabled={Boolean(repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey) && !repoClaudeCodeChangingApiKey}
                                    placeholder={
                                      repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey && !repoClaudeCodeChangingApiKey
                                        ? t('panel.credentials.secretConfiguredPlaceholder')
                                        : t('panel.credentials.secretInputPlaceholder')
                                    }
                                    autoComplete="new-password"
                                  />
                                </Form.Item>

                                <Divider style={{ margin: '12px 0' }} />

                                <div>
                                  <Typography.Text strong>{t('repos.robotForm.modelProvider.gemini_cli')}</Typography.Text>
                                  <div style={{ marginTop: 6 }}>
                                    <Typography.Text type="secondary">
                                      {t('repos.detail.credentials.modelProviderStatus')}:{' '}
                                      <Tag color={repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey ? 'green' : 'default'}>
                                        {repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey ? t('common.configured') : t('common.notConfigured')}
                                      </Tag>
                                    </Typography.Text>
                                  </div>
                                </div>

                                <Form.Item
                                  label={t('panel.credentials.geminiCliApiKey')}
                                  name="geminiCliApiKey"
                                  extra={
                                    repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey ? (
                                      <Button
                                        type="link"
                                        size="small"
                                        style={{ padding: 0 }}
                                        onClick={() => {
                                          setRepoGeminiCliChangingApiKey((v) => {
                                            const next = !v;
                                            if (!next) credentialsForm.setFieldsValue({ geminiCliApiKey: '' });
                                            return next;
                                          });
                                        }}
                                      >
                                        {repoGeminiCliChangingApiKey ? t('common.cancel') : t('panel.credentials.changeSecret')}
                                      </Button>
                                    ) : undefined
                                  }
                                >
                                  <Input.Password
                                    disabled={Boolean(repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey) && !repoGeminiCliChangingApiKey}
                                    placeholder={
                                      repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey && !repoGeminiCliChangingApiKey
                                        ? t('panel.credentials.secretConfiguredPlaceholder')
                                        : t('panel.credentials.secretInputPlaceholder')
                                    }
                                    autoComplete="new-password"
                                  />
                                </Form.Item>
                              </Space>
                            </Col>
                          </Row>
                        </Form>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <Button type="primary" icon={<SaveOutlined />} loading={credentialsSaving} onClick={() => void handleSaveCredentials()}>
                            {t('common.save')}
                          </Button>
                        </div>
                      </Card>
                    )
                  },
                  {
                    key: 'robots',
                    label: t('repos.detail.tabs.robots'),
                    children: (
                      <Card
                        size="small"
                        title={t('repos.robots.title')}
                        className="hc-card"
                        extra={
                          <Button icon={<PlusOutlined />} onClick={openCreateRobot} disabled={!webhookVerified}>
                            {t('repos.robots.createRobot')}
                          </Button>
                        }
                      >
                        {robotsSorted.length ? (
                          <ScrollableTable<RepoRobot>
                            rowKey="id"
                            dataSource={robotsSorted}
                            pagination={false}
                            columns={[
                              {
                                title: t('common.name'),
                                dataIndex: 'name',
                                render: (_: any, r: RepoRobot) => (
                                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                    <Typography.Text strong className="table-cell-ellipsis" title={r.name}>
                                      {r.name}
                                    </Typography.Text>
                                    <Typography.Text type="secondary" className="table-cell-ellipsis" style={{ fontSize: 12 }} title={r.id}>
                                      {r.id}
                                    </Typography.Text>
                                  </Space>
                                )
                              },
                              {
                                title: t('common.status'),
                                key: 'status',
                                width: 140,
                                render: (_: any, r: RepoRobot) => resolveRobotStatusTag(t, r)
                              },
                              {
                                title: t('repos.robots.permission'),
                                dataIndex: 'permission',
                                width: 120,
                                render: (v: string) => <Tag color={v === 'write' ? 'volcano' : 'blue'}>{v}</Tag>
                              },
                              {
                                title: t('repos.robots.default'),
                                dataIndex: 'isDefault',
                                width: 110,
                                render: (v: boolean) => (v ? <Tag color="blue">{t('repos.robots.default')}</Tag> : <Typography.Text type="secondary">-</Typography.Text>)
                              },
                              {
                                title: t('repos.robots.lastTest'),
                                key: 'lastTest',
                                width: 220,
                                render: (_: any, r: RepoRobot) => {
                                  if (!r.lastTestAt) return <Typography.Text type="secondary">-</Typography.Text>;
                                  const ok = Boolean(r.lastTestOk);
                                  return (
                                    <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                                        {formatTime(r.lastTestAt)}
                                      </Typography.Text>
                                      <Typography.Text type={ok ? 'success' : 'danger'} style={{ fontSize: 12 }}>
                                        {ok ? t('repos.robots.test.ok') : t('repos.robots.test.notOk')}
                                      </Typography.Text>
                                    </Space>
                                  );
                                }
                              },
                              {
                                title: t('common.actions'),
                                key: 'actions',
                                width: 300,
                                render: (_: any, r: RepoRobot) => (
                                  <Space size={8} wrap style={{ minWidth: 0 }}>
                                    <Button size="small" onClick={() => openEditRobot(r)}>
                                      {t('common.edit')}
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => void handleTestRobot(r)}
                                      loading={robotTestingId === r.id}
                                      disabled={!webhookVerified}
                                    >
                                      {t('repos.robots.test')}
                                    </Button>
                                    <Button
                                      size="small"
                                      onClick={() => void handleToggleRobotEnabled(r)}
                                      loading={robotTogglingId === r.id}
                                      disabled={!webhookVerified}
                                    >
                                      {r.enabled ? t('repos.robots.disable') : t('repos.robots.enable')}
                                    </Button>
                                    <Popconfirm
                                      title={t('repos.robots.deleteConfirmTitle')}
                                      description={t('repos.robots.deleteConfirmDesc')}
                                      okText={t('common.delete')}
                                      cancelText={t('common.cancel')}
                                      onConfirm={() => void handleDeleteRobot(r)}
                                    >
                                      <Button size="small" danger loading={robotDeletingId === r.id} disabled={!webhookVerified}>
                                        {t('common.delete')}
                                      </Button>
                                    </Popconfirm>
                                  </Space>
                                )
                              }
                            ]}
                          />
                        ) : (
                          <Empty description={t('repos.detail.robotsEmpty')} />
                        )}
                      </Card>
                    )
                  },
                  {
                    key: 'automation',
                    label: t('repos.detail.tabs.automation'),
                    children: (
                      <Card size="small" title={t('repos.automation.title')} className="hc-card">
                        <RepoAutomationPanel
                          repo={repo}
                          robots={robotsSorted}
                          value={automationConfig ?? defaultAutomationConfig()}
                          onChange={(next) => setAutomationConfig(next)}
                          readOnly={!webhookVerified}
                          onSave={async (next) => {
                            if (!webhookVerified) return;
                            const saved = await updateRepoAutomation(repo.id, next);
                            setAutomationConfig(saved);
                          }}
                        />
                      </Card>
                    )
                  },
                  {
                    key: 'webhooks',
                    label: t('repos.detail.tabs.webhooks'),
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Card
                          size="small"
                          title={t('repos.detail.webhookTitle')}
                          className="hc-card"
                          extra={
                            <Button type="link" size="small" onClick={() => setWebhookIntroOpen(true)}>
                              {t('repos.webhookIntro.open')}
                            </Button>
                          }
                        >
                          <Descriptions column={1} size="small" styles={{ label: { width: 180 } }}>
                            <Descriptions.Item label={t('repos.detail.webhookPath')}>
                              {webhookPath ? <Typography.Text code>{webhookPath}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text>}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('repos.webhookIntro.webhookUrl')}>
                              {webhookFullUrl ? (
                                <Typography.Text code copyable style={{ wordBreak: 'break-all' }}>
                                  {webhookFullUrl}
                                </Typography.Text>
                              ) : (
                                <Typography.Text type="secondary">-</Typography.Text>
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('repos.detail.webhookSecret')}>
                              {webhookSecret ? <Typography.Text code>{webhookSecret}</Typography.Text> : <Typography.Text type="secondary">-</Typography.Text>}
                            </Descriptions.Item>
                            <Descriptions.Item label={t('repos.webhookIntro.verified')}>
                              {webhookVerified ? <Tag color="green">{t('repos.webhookIntro.verifiedYes')}</Tag> : <Tag color="gold">{t('repos.webhookIntro.verifiedNo')}</Tag>}
                            </Descriptions.Item>
                          </Descriptions>
                          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                            {t('repos.detail.webhookTip')}
                          </Typography.Paragraph>
                        </Card>

                        <Card size="small" title={t('repos.webhookDeliveries.title')} className="hc-card">
                          <RepoWebhookDeliveriesPanel repoId={repo.id} />
                        </Card>
                      </Space>
                    )
                  }
                ]}
              />
            </Space>
          ) : (
            <div className="hc-empty">
              <Empty description={loading ? t('common.loading') : t('repos.detail.notFound')} />
            </div>
          )}
        </div>
      </div>

      <WebhookIntroModal
        open={webhookIntroOpen}
        provider={repo?.provider ?? 'gitlab'}
        webhookUrl={webhookFullUrl || webhookPath}
        webhookSecret={webhookSecret}
        onClose={() => setWebhookIntroOpen(false)}
      />

      <ResponsiveDialog
        variant="large"
        open={robotModalOpen}
        title={
          editingRobot
            ? t('repos.robotModal.titleEdit', { name: editingRobot.name || editingRobot.id })
            : t('repos.robotModal.titleCreate')
        }
        onCancel={() => setRobotModalOpen(false)}
        okText={t('common.save')}
        cancelText={t('common.cancel')}
        confirmLoading={robotSubmitting}
        onOk={() => void robotForm.submit()}
        drawerWidth="min(980px, 92vw)"
      >
        <Form<RobotFormValues>
          form={robotForm}
          layout="vertical"
          requiredMark={false}
          disabled={robotSubmitting}
          onFinish={(values) => void handleSubmitRobot(values)}
          initialValues={buildRobotInitialValues(editingRobot)}
        >
          {!webhookVerified ? <Alert type="warning" showIcon message={t('repos.webhookIntro.notVerified')} style={{ marginBottom: 12 }} /> : null}

          {userModelCredentialsError ? (
            <Alert type="warning" showIcon message={t('repos.robotForm.userCredentialsLoadFailed')} style={{ marginBottom: 12 }} />
          ) : null}

          <Form.Item label={t('repos.robotForm.name')} name="name" rules={[{ required: true, message: t('repos.form.nameRequired') }]}>
            <Input placeholder={t('repos.robotForm.namePlaceholder')} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label={t('repos.robotForm.language')} name="language" rules={[{ required: true, message: t('panel.validation.required') }]}>
                <Select
                  options={supportedLocales.map((l) => ({ value: l, label: l }))}
                  placeholder={t('repos.robotForm.languagePlaceholder')}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('repos.robotForm.defaultBranch')} name="defaultBranch">
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  placeholder={t('repos.robotForm.defaultBranchPlaceholder')}
                  options={(repo?.branches ?? [])
                    .filter((b) => (b.name ?? '').trim())
                    .map((b) => ({ value: b.name, label: b.note ? `${b.name}（${b.note}）` : b.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('repos.robotForm.isDefault')} name="isDefault" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Card size="small" title={t('repos.robotForm.section.prompt')} className="hc-inner-card" styles={{ body: { padding: 12 } }}>
            <Form.Item
              label={t('repos.robotForm.promptDefault')}
              name="promptDefault"
              rules={[{ required: true, message: t('repos.robotForm.promptRequired') }]}
            >
              <TemplateEditor rows={10} placeholder={t('repos.robotForm.promptPlaceholder')} />
            </Form.Item>
          </Card>

          <div style={{ height: 12 }} />

          <Card size="small" title={t('repos.robotForm.section.credentials')} className="hc-inner-card" styles={{ body: { padding: 12 } }}>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item
                  label={t('repos.robotForm.repoCredential.source')}
                  name="repoCredentialSource"
                  rules={[{ required: true, message: t('repos.robotForm.repoCredential.sourceRequired') }]}
                >
                  <Select
                    options={[
                      { value: 'user', label: t('repos.robotForm.repoCredential.source.user') },
                      { value: 'repo', label: t('repos.robotForm.repoCredential.source.repo') },
                      { value: 'robot', label: t('repos.robotForm.repoCredential.source.robot') }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={t('repos.robotForm.repoCredential.profile')} name="repoCredentialProfileId">
                  <Select
                    disabled={watchedRepoCredentialSource !== 'user'}
                    loading={userModelCredentialsLoading}
                    placeholder={t('repos.robotForm.repoCredential.profilePlaceholder')}
                    options={(() => {
                      const providerCredentials = repo?.provider === 'github' ? userModelCredentials?.github : userModelCredentials?.gitlab;
                      const profiles = providerCredentials?.profiles ?? [];
                      return profiles.map((p) => ({ value: p.id, label: p.name || p.id, disabled: !p.hasToken }));
                    })()}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item shouldUpdate noStyle>
              {({ getFieldValue }) => {
                const source = getFieldValue('repoCredentialSource') as string;
                const normalizedSource = source === 'robot' || source === 'repo' ? source : 'user';
                const hasToken = Boolean(editingRobot?.hasToken);
                const tokenDisabled = normalizedSource !== 'robot' || (Boolean(editingRobot) && hasToken && !robotChangingToken);

                return normalizedSource === 'robot' ? (
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item
                        label={t('repos.robotForm.repoCredential.token')}
                        name="token"
                        rules={[
                          {
                            required: !editingRobot || !hasToken || robotChangingToken,
                            whitespace: true,
                            message: t('repos.robotForm.repoCredential.tokenRequired')
                          }
                        ]}
                        extra={
                          editingRobot && hasToken ? (
                            <Button
                              type="link"
                              size="small"
                              style={{ padding: 0 }}
                              onClick={() => {
                                setRobotChangingToken((v) => {
                                  const next = !v;
                                  if (!next) robotForm.setFieldsValue({ token: '' });
                                  return next;
                                });
                              }}
                            >
                              {robotChangingToken ? t('common.cancel') : t('panel.credentials.changeSecret')}
                            </Button>
                          ) : undefined
                        }
                      >
                        <Input.Password
                          disabled={tokenDisabled}
                          placeholder={tokenDisabled ? t('panel.credentials.secretConfiguredPlaceholder') : t('panel.credentials.secretInputPlaceholder')}
                          autoComplete="new-password"
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={12}>
                      <Form.Item label={t('repos.robotForm.repoCredential.cloneUsername')} name="cloneUsername">
                        <Input placeholder={t('repos.robotForm.repoCredential.cloneUsernamePlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>
                ) : normalizedSource === 'repo' ? (
                  <Alert
                    type={repoScopedCredentials?.repoProvider?.hasToken ? 'info' : 'warning'}
                    showIcon
                    message={
                      repoScopedCredentials?.repoProvider?.hasToken
                        ? t('repos.robotForm.repoCredential.repoConfigured')
                        : t('repos.robotForm.repoCredential.repoNotConfigured')
                    }
                    style={{ marginBottom: 12 }}
                  />
                ) : (
                  <Alert
                    type={userModelCredentials?.[repo?.provider === 'github' ? 'github' : 'gitlab']?.profiles?.some((p: any) => p.hasToken) ? 'info' : 'warning'}
                    showIcon
                    message={t('repos.robotForm.repoCredential.userTip')}
                    style={{ marginBottom: 12 }}
                  />
                );
              }}
            </Form.Item>

            <Form.Item shouldUpdate noStyle>
              {({ getFieldValue }) => {
                const providerRaw = String(getFieldValue('modelProvider') ?? '').trim();
                const provider = providerRaw === 'claude_code' ? 'claude_code' : providerRaw === 'gemini_cli' ? 'gemini_cli' : 'codex';
                const isCodex = provider === 'codex';
                const source = normalizeCredentialSource(getFieldValue(['modelProviderConfig', 'credentialSource']));
                const sandbox = normalizeCodexSandbox(getFieldValue(['modelProviderConfig', 'sandbox']));

                const networkAccessDisabled = sandbox !== 'workspace-write';

                const editingRobotHasApiKey = Boolean(
                  editingRobot &&
                    String(editingRobot.modelProvider ?? '').trim() === provider &&
                    (editingRobot.modelProviderConfig as any)?.credential?.hasApiKey
                );
                const apiKeyDisabled = Boolean(editingRobot) && editingRobotHasApiKey && !robotChangingModelApiKey && source === 'robot';

                const repoHasApiKey =
                  provider === 'codex'
                    ? Boolean(repoScopedCredentials?.modelProvider?.codex?.hasApiKey)
                    : provider === 'claude_code'
                      ? Boolean(repoScopedCredentials?.modelProvider?.claude_code?.hasApiKey)
                      : Boolean(repoScopedCredentials?.modelProvider?.gemini_cli?.hasApiKey);
                const userHasApiKey =
                  provider === 'codex'
                    ? Boolean(userModelCredentials?.codex?.hasApiKey)
                    : provider === 'claude_code'
                      ? Boolean(userModelCredentials?.claude_code?.hasApiKey)
                      : Boolean(userModelCredentials?.gemini_cli?.hasApiKey);

                const userSourceLabel =
                  provider === 'codex'
                    ? t('repos.robotForm.modelCredential.source.user')
                    : provider === 'claude_code'
                      ? t('repos.robotForm.modelCredential.source.user.claude_code')
                      : t('repos.robotForm.modelCredential.source.user.gemini_cli');

                const repoConfiguredKey =
                  provider === 'codex'
                    ? 'repos.robotForm.modelCredential.repoConfigured'
                    : provider === 'claude_code'
                      ? 'repos.robotForm.modelCredential.repoConfigured.claude_code'
                      : 'repos.robotForm.modelCredential.repoConfigured.gemini_cli';
                const repoNotConfiguredKey =
                  provider === 'codex'
                    ? 'repos.robotForm.modelCredential.repoNotConfigured'
                    : provider === 'claude_code'
                      ? 'repos.robotForm.modelCredential.repoNotConfigured.claude_code'
                      : 'repos.robotForm.modelCredential.repoNotConfigured.gemini_cli';
                const userTipKey =
                  provider === 'codex'
                    ? 'repos.robotForm.modelCredential.userTip'
                    : provider === 'claude_code'
                      ? 'repos.robotForm.modelCredential.userTip.claude_code'
                      : 'repos.robotForm.modelCredential.userTip.gemini_cli';

                return (
                  <Card size="small" title={t('repos.robotForm.section.model')} className="hc-inner-card" styles={{ body: { padding: 12 } }}>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label={t('repos.robotForm.modelProvider')}
                          name="modelProvider"
                          rules={[{ required: true, message: t('repos.robotForm.modelProviderRequired') }]}
                        >
                          <Select
                            options={[
                              { value: 'codex', label: t('repos.robotForm.modelProvider.codex') },
                              { value: 'claude_code', label: t('repos.robotForm.modelProvider.claude_code') },
                              { value: 'gemini_cli', label: t('repos.robotForm.modelProvider.gemini_cli') }
                            ]}
                            onChange={(value) => {
                              const raw = String(value ?? '').trim();
                              const nextProvider = raw === 'claude_code' ? 'claude_code' : raw === 'gemini_cli' ? 'gemini_cli' : 'codex';
                              const defaults =
                                nextProvider === 'claude_code'
                                  ? {
                                      credentialSource: 'user',
                                      model: 'claude-sonnet-4-5-20250929',
                                      sandbox: 'read-only',
                                      sandbox_workspace_write: { network_access: false }
                                    }
                                  : nextProvider === 'gemini_cli'
                                    ? {
                                        credentialSource: 'user',
                                        model: 'gemini-2.5-pro',
                                        sandbox: 'read-only',
                                        sandbox_workspace_write: { network_access: false }
                                      }
                                  : {
                                      credentialSource: 'user',
                                      model: 'gpt-5.2',
                                      sandbox: 'read-only',
                                      model_reasoning_effort: 'medium',
                                      sandbox_workspace_write: { network_access: false }
                                    };
                              // UX: switching model provider resets the provider-specific config to avoid invalid mixes.
                              setRobotChangingModelApiKey(false);
                              robotForm.setFieldsValue({ modelProvider: nextProvider as any, modelProviderConfig: defaults as any });
                            }}
                          />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item
                          label={t('repos.robotForm.modelCredential.source')}
                          name={['modelProviderConfig', 'credentialSource']}
                          rules={[{ required: true, message: t('repos.robotForm.modelCredential.sourceRequired') }]}
                        >
                          <Select
                            options={[
                              { value: 'user', label: userSourceLabel },
                              { value: 'repo', label: t('repos.robotForm.modelCredential.source.repo') },
                              { value: 'robot', label: t('repos.robotForm.modelCredential.source.robot') }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    {source === 'robot' ? (
                      <Row gutter={16}>
                        {isCodex ? (
                          <Col xs={24} md={12}>
                            <Form.Item
                              label={t('repos.robotForm.modelCredential.apiBaseUrl')}
                              name={['modelProviderConfig', 'credential', 'apiBaseUrl']}
                            >
                              <Input placeholder={t('repos.robotForm.modelCredential.apiBaseUrlPlaceholder')} />
                            </Form.Item>
                          </Col>
                        ) : null}
                        <Col xs={24} md={isCodex ? 12 : 24}>
                          <Form.Item
                            label={t('repos.robotForm.modelCredential.apiKey')}
                            name={['modelProviderConfig', 'credential', 'apiKey']}
                            rules={[
                              {
                                required: !editingRobot || robotChangingModelApiKey || !editingRobotHasApiKey,
                                whitespace: true,
                                message: t('repos.robotForm.modelCredential.apiKeyRequired')
                              }
                            ]}
                            extra={
                              editingRobot && editingRobotHasApiKey ? (
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ padding: 0 }}
                                  onClick={() => {
                                    setRobotChangingModelApiKey((v) => {
                                      const next = !v;
                                      if (!next) robotForm.setFieldsValue({ modelProviderConfig: { ...robotForm.getFieldValue('modelProviderConfig'), credential: { ...robotForm.getFieldValue(['modelProviderConfig', 'credential']), apiKey: '' } } } as any);
                                      return next;
                                    });
                                  }}
                                >
                                  {robotChangingModelApiKey ? t('common.cancel') : t('repos.robotForm.modelCredential.changeApiKey')}
                                </Button>
                              ) : undefined
                            }
                          >
                            <Input.Password
                              disabled={apiKeyDisabled}
                              placeholder={apiKeyDisabled ? t('panel.credentials.secretConfiguredPlaceholder') : t('panel.credentials.secretInputPlaceholder')}
                              autoComplete="new-password"
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    ) : source === 'repo' ? (
                      <Alert
                        type={repoHasApiKey ? 'info' : 'warning'}
                        showIcon
                        message={
                          repoHasApiKey ? t(repoConfiguredKey) : t(repoNotConfiguredKey)
                        }
                        style={{ marginBottom: 12 }}
                      />
                    ) : (
                      <Alert
                        type={userHasApiKey ? 'info' : 'warning'}
                        showIcon
                        message={t(userTipKey)}
                        style={{ marginBottom: 12 }}
                      />
                    )}

                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item label={t('repos.robotForm.model')} name={['modelProviderConfig', 'model']} rules={[{ required: true, message: t('panel.validation.required') }]}>
                          {isCodex ? (
                            <Select
                              options={[
                                { value: 'gpt-5.2', label: 'gpt-5.2' },
                                { value: 'gpt-5.1-codex-max', label: 'gpt-5.1-codex-max' },
                                { value: 'gpt-5.1-codex-mini', label: 'gpt-5.1-codex-mini' }
                              ]}
                            />
                          ) : (
                            <Input />
                          )}
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label={t('repos.robotForm.sandbox')} name={['modelProviderConfig', 'sandbox']} rules={[{ required: true, message: t('panel.validation.required') }]}>
                          <Select
                            options={[
                              { value: 'read-only', label: t('repos.robotForm.sandbox.readOnly') },
                              { value: 'workspace-write', label: t('repos.robotForm.sandbox.workspaceWrite') }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={16}>
                      {isCodex ? (
                        <Col xs={24} md={12}>
                          <Form.Item
                            label={t('repos.robotForm.reasoningEffort')}
                            name={['modelProviderConfig', 'model_reasoning_effort']}
                            rules={[{ required: true, message: t('panel.validation.required') }]}
                          >
                            <Select
                              options={[
                                { value: 'low', label: 'low' },
                                { value: 'medium', label: 'medium' },
                                { value: 'high', label: 'high' },
                                { value: 'xhigh', label: 'xhigh' }
                              ]}
                            />
                          </Form.Item>
                        </Col>
                      ) : null}
                      <Col xs={24} md={isCodex ? 12 : 24}>
                        <Form.Item label={t('repos.robotForm.networkAccess')} name={['modelProviderConfig', 'sandbox_workspace_write', 'network_access']} valuePropName="checked">
                          <Switch disabled={networkAccessDisabled} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                );
              }}
            </Form.Item>

            {editingRobot ? (
              <Alert
                type="info"
                showIcon
                message={t('repos.robotForm.activationTip')}
                description={
                  <Space direction="vertical" size={4}>
                    <Typography.Text type="secondary">
                      {t('repos.robotForm.activation.lastTestAt')}: {editingRobot.lastTestAt ? formatTime(editingRobot.lastTestAt) : '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      {t('repos.robotForm.activation.lastTestMessage')}: {editingRobot.lastTestMessage ? editingRobot.lastTestMessage : '-'}
                    </Typography.Text>
                  </Space>
                }
                style={{ marginTop: 12 }}
              />
            ) : null}
          </Card>
        </Form>
      </ResponsiveDialog>
    </>
  );
};

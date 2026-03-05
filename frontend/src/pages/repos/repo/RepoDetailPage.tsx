// Update imports after per-page nested folder migration. docs/en/developer/plans/frontend-page-folder-refactor-20260305/task_plan.md frontend-page-folder-refactor-20260305
import { FC, useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  App,
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography
} from 'antd';
import { ApiOutlined, GlobalOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import type {
  CodexRobotProviderConfigPublic,
  ClaudeCodeRobotProviderConfigPublic,
  GeminiCliRobotProviderConfigPublic,
  ModelProvider,
  ModelProviderModelsResponse,
  RepoAutomationConfig,
  RepoRobot,
  RepoPreviewEnvConfigPublic, // Track repo preview env config types for the env tab. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
  RepoScopedCredentialsPublic,
  RepoPreviewConfigResponse,
  RepoInvite,
  RepoMember,
  RepoRole,
  Repository,
  SkillSelectionKey,
  SkillSelectionState,
  TaskGroup,
  TimeWindow,
  UserApiTokenPublic,
  UserModelCredentialsPublic,
  UserModelProviderCredentialProfilePublic,
  UserRepoProviderCredentialProfilePublic
} from '../../../api';
import {
  archiveRepo,
  createRepoRobot,
  createRepoInvite,
  deleteRepo,
  deleteRepoRobot,
  fetchMyApiTokens,
  fetchMyModelCredentials,
  fetchRepo,
  fetchRepoSkillSelection,
  fetchRepoPreviewConfig,
  fetchTaskGroups,
  listMyModelProviderModels,
  listRepoInvites,
  listRepoMembers,
  listRepoModelProviderModels,
  removeRepoMember,
  revokeMyApiToken,
  revokeRepoInvite,
  unarchiveRepo,
  testRepoRobot,
  testRepoRobotWorkflow, // Add workflow-mode test API to validate direct/fork selection. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  updateRepo,
  updateRepoAutomation,
  updateRepoMemberRole,
  updateRepoRobot,
  updateRepoSkillSelection
} from '../../../api';
import { supportedLocales, useLocale, useT } from '../../../i18n';
import { buildReposHash, buildTaskHash, buildRepoHash } from '../../../router';
import type { RepoTab } from '../../../router';
import { getPrevHashForBack, isInAppHash } from '../../../navHistory';
import { getStoredUser } from '../../../auth';
import { RepoAutomationPanel } from '../../../components/repoAutomation/RepoAutomationPanel';
import { RepoBranchesCard } from '../../../components/repos/RepoBranchesCard';
import { RepoWebhookDeliveriesPanel } from '../../../components/repos/RepoWebhookDeliveriesPanel';
import { WebhookIntroModal } from '../../../components/repos/WebhookIntroModal';
import { RepoOnboardingWizard } from '../../../components/repos/RepoOnboardingWizard';
import { ResponsiveDialog } from '../../../components/dialogs/ResponsiveDialog';
import { TemplateEditor } from '../../../components/TemplateEditor';
import { ScrollableTable } from '../../../components/ScrollableTable';
import { PageNav, type PageNavMenuAction } from '../../../components/nav/PageNav';
import { buildWebhookUrl } from '../../../utils/webhook';
import { getRobotProviderLabel } from '../../../utils/robot';
import { extractTaskGroupIdFromTokenName } from '../../../utils/apiTokens';
import { RepoDetailSidebar } from '../../../components/repos/RepoDetailSidebar';
import { RepoDetailSkeleton } from '../../../components/skeletons/RepoDetailSkeleton';
import { RepoDetailDashboardSummaryStrip } from '../../../components/repos/RepoDetailDashboardSummaryStrip';
import { RepoWebhookActivityCard } from '../../../components/repos/RepoWebhookActivityCard';
import { RepoTaskActivityCard } from '../../../components/repos/RepoTaskActivityCard';
import { ModelProviderModelsButton } from '../../../components/ModelProviderModelsButton';
import { RepoDetailProviderActivityRow } from '../../../components/repos/RepoDetailProviderActivityRow';
import { RepoEnvConfigPanel } from '../../../components/repos/RepoEnvConfigPanel'; // Render repo preview env editor panel. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
import { TimeWindowPicker } from '../../../components/TimeWindowPicker';
import { uuid as generateUuid } from '../../../components/repoAutomation/utils';
import { useRepoWebhookDeliveries } from '../../../hooks/useRepoWebhookDeliveries';
import { SkillSelectionPanel } from '../../../components/skills/SkillSelectionPanel';
import { useSkillsCatalog } from '../../../hooks/useSkillsCatalog';

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
 * Important notes:
 * - Webhook verification is optional; it enables provider-triggered automation and delivery troubleshooting. 58w1q3n5nr58flmempxe
 *
 * Change record:
 * - 2026-01-12: Expanded the initial `frontend-chat` stub into a feature-complete migration from legacy `frontend`.
 * - 2026-01-12: Remove header refresh button to keep the PageNav actions minimal (content uses auto-refresh where needed).
 * - 2026-01-12: Move header save button into the corresponding tab content (avoid global actions in PageNav).
 * - 2026-01-13: Added Claude Code (`claude_code`) model provider support for repo-scoped credentials and robot configuration.
 * - 2026-01-13: Added Gemini CLI (`gemini_cli`) model provider support for repo-scoped credentials and robot configuration.
 */

// Accept repoTab for sidebar sub-navigation routing. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
export interface RepoDetailPageProps {
  repoId: string;
  repoTab?: RepoTab;
  userPanel?: ReactNode;
  navToggle?: PageNavMenuAction;
}

type ModelProviderKey = 'codex' | 'claude_code' | 'gemini_cli';

type RobotFormValues = {
  name: string;
  repoCredentialSource: 'user' | 'repo' | 'robot';
  repoCredentialProfileId?: string | null;
  repoCredentialRemark?: string | null;
  token?: string;
  cloneUsername?: string;
  promptDefault?: string;
  language: string;
  defaultBranch?: string | null;
  // Track the robot workflow mode selection in the edit form. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  repoWorkflowMode?: 'auto' | 'direct' | 'fork';
  // Track robot-level scheduling windows in the editor. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
  timeWindow?: TimeWindow | null;
  isDefault: boolean;
  // Expose dependency overrides in the robot editor to control install behavior. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
  dependencyOverride: boolean;
  dependencyConfig: {
    enabled: boolean;
    failureMode: 'inherit' | 'soft' | 'hard';
    allowCustomInstall: boolean;
  };
  modelProvider: ModelProvider;
  modelProviderConfig: Partial<CodexRobotProviderConfigPublic | ClaudeCodeRobotProviderConfigPublic | GeminiCliRobotProviderConfigPublic> & {
    credentialSource?: 'user' | 'repo' | 'robot';
    credentialProfileId?: string | null;
    credential?: { apiBaseUrl?: string; apiKey?: string; hasApiKey?: boolean; remark?: string };
    sandbox_workspace_write?: { network_access?: boolean };
  };
};

type ModelPickerFieldProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value?: string;
  onChange?: (nextValue: string) => void;
  pickerDisabled?: boolean;
  loadModels: (params: { forceRefresh: boolean }) => Promise<ModelProviderModelsResponse>;
};

const ModelPickerField: FC<ModelPickerFieldProps> = ({ value, onChange, pickerDisabled, loadModels, ...inputProps }) => {
  // Keep the model field controlled so picker selections propagate through Form.Item. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0
  return (
    <Space.Compact style={{ width: '100%' }}>
      <Input {...inputProps} value={value} onChange={(event) => onChange?.(event.target.value)} />
      <ModelProviderModelsButton
        disabled={pickerDisabled}
        buttonProps={{ size: 'middle' }}
        loadModels={loadModels}
        onPickModel={(model) => onChange?.(model)}
      />
    </Space.Compact>
  );
};

const providerLabel = (provider: string) => (provider === 'github' ? 'GitHub' : 'GitLab');

const ONBOARDING_STORAGE_PREFIX = 'hookcode-repo-onboarding:'; // Persist per-repo onboarding completion in localStorage. 58w1q3n5nr58flmempxe

const CREDENTIAL_PROFILE_PAGE_SIZE = 4; // Limit credential profile list height so the dashboard board stays visually dense. u55e45ffi8jng44erdzp
const TASK_GROUP_TOKEN_PAGE_SIZE = 10; // Paginate task-group tokens for the dedicated tab view. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302

const getOnboardingKey = (repoId: string): string => `${ONBOARDING_STORAGE_PREFIX}${repoId}`;

const getOnboardingDone = (repoId: string): boolean => {
  try {
    return Boolean(typeof window !== 'undefined' && window.localStorage?.getItem(getOnboardingKey(repoId)));
  } catch {
    return false;
  }
};

const markOnboardingDone = (repoId: string, mode: 'skipped' | 'completed'): void => {
  try {
    window.localStorage?.setItem(getOnboardingKey(repoId), mode);
  } catch {
    // ignore: storage may be unavailable (private mode, disabled). 58w1q3n5nr58flmempxe
  }
};

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

export const RepoDetailPage: FC<RepoDetailPageProps> = ({ repoId, repoTab, userPanel, navToggle }) => {
  // Resolve active tab from route, defaulting to overview. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const activeTab: RepoTab = repoTab || 'overview';
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

  const [loading, setLoading] = useState(false);
  const [repo, setRepo] = useState<Repository | null>(null);
  const [robots, setRobots] = useState<RepoRobot[]>([]);
  const [automationConfig, setAutomationConfig] = useState<RepoAutomationConfig | null>(null);
  const [webhookSecret, setWebhookSecret] = useState<string | null>(null);
  const [webhookPathRaw, setWebhookPathRaw] = useState<string | null>(null);
  const [repoScopedCredentials, setRepoScopedCredentials] = useState<RepoScopedCredentialsPublic | null>(null);
  const [previewEnvConfig, setPreviewEnvConfig] = useState<RepoPreviewEnvConfigPublic | null>(null); // Store repo preview env config in local state. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
  const [previewEnvSaving, setPreviewEnvSaving] = useState(false); // Track preview env save state for repo settings. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
  // Track auto-generated task-group PATs for the repo credentials view. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
  const [repoTaskGroupTokens, setRepoTaskGroupTokens] = useState<UserApiTokenPublic[]>([]);
  const [repoTaskGroupTokensLoading, setRepoTaskGroupTokensLoading] = useState(false);
  const [repoTaskGroupTokenRevokingId, setRepoTaskGroupTokenRevokingId] = useState<string | null>(null);
  const [repoTaskGroupTokensPage, setRepoTaskGroupTokensPage] = useState(1); // Track task-group token pagination for the dedicated tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
  // Track preview config availability for repo detail UI. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const [previewConfig, setPreviewConfig] = useState<RepoPreviewConfigResponse | null>(null);
  const [previewConfigLoading, setPreviewConfigLoading] = useState(false);
  const { skills: skillsCatalog, loading: skillsCatalogLoading, refresh: refreshSkillsCatalog } = useSkillsCatalog();
  // Track repo-level skill selections for default task-group behavior. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
  const [skillSelection, setSkillSelection] = useState<SkillSelectionState | null>(null);
  const [skillSelectionLoading, setSkillSelectionLoading] = useState(false);
  const [skillSelectionSaving, setSkillSelectionSaving] = useState(false);
  // Share webhook delivery data across dashboard cards to avoid duplicate requests. docs/en/developer/plans/repo-page-slow-requests-20260128/task_plan.md repo-page-slow-requests-20260128
  const {
    deliveries: webhookDeliveries,
    loading: webhookDeliveriesLoading,
    loadFailed: webhookDeliveriesFailed,
    refresh: refreshWebhookDeliveries
  } = useRepoWebhookDeliveries(repoId);

  const [webhookIntroOpen, setWebhookIntroOpen] = useState(false);
  const [showWebhookSecretInline, setShowWebhookSecretInline] = useState(false);

  const [onboardingOpen, setOnboardingOpen] = useState(() => !getOnboardingDone(repoId)); // Show onboarding wizard on first entry. 58w1q3n5nr58flmempxe

  const [basicSaving, setBasicSaving] = useState(false);
  const [credentialsSaving, setCredentialsSaving] = useState(false);
  const [repoArchiving, setRepoArchiving] = useState(false);
  const [repoUnarchiving, setRepoUnarchiving] = useState(false);
  const [repoDeleting, setRepoDeleting] = useState(false);
  // Track repo member and invite data for RBAC management UI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const [members, setMembers] = useState<RepoMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberUpdatingId, setMemberUpdatingId] = useState<string | null>(null);
  const [memberRemovingId, setMemberRemovingId] = useState<string | null>(null);
  const [invites, setInvites] = useState<RepoInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteRevokingId, setInviteRevokingId] = useState<string | null>(null);
  const [inviteForm] = Form.useForm<{ email: string; role: RepoRole }>();

  const repoArchived = Boolean(repo?.archivedAt); // Disable edits when repo is archived (archive area is read-only). qnp1mtxhzikhbi0xspbc
  const currentUserId = getStoredUser()?.id ?? '';
  // Derive repo permission flags for UI gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const canManageRepo = Boolean(repo?.permissions?.canManage);
  const canDeleteRepo = Boolean(repo?.permissions?.canDelete);
  const canManageMembers = Boolean(repo?.permissions?.canManageMembers);
  const repoReadOnly = repoArchived || !canManageRepo;

  const [repoProviderProfilesPage, setRepoProviderProfilesPage] = useState(1);
  // Track unified model profile pagination state for the merged list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
  const [modelProviderProfilesPage, setModelProviderProfilesPage] = useState(1);

  const modelProviderProfileItems = useMemo(() => {
    // Flatten repo-scoped model profiles for the unified list display. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    return (['codex', 'claude_code', 'gemini_cli'] as ModelProviderKey[]).flatMap((provider) => {
      const providerCredentials = (repoScopedCredentials as any)?.modelProvider?.[provider] as any;
      const profiles = Array.isArray(providerCredentials?.profiles) ? providerCredentials.profiles : [];
      const defaultId = String(providerCredentials?.defaultProfileId ?? '').trim();
      return profiles.map((profile: UserModelProviderCredentialProfilePublic) => ({ provider, profile, defaultId }));
    });
  }, [repoScopedCredentials]);

  useEffect(() => {
    // Reset credentials pagination on repo switch to avoid blank pages when profile counts change. u55e45ffi8jng44erdzp
    setRepoProviderProfilesPage(1);
    // Reset unified model profile pagination on repo switch. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    setModelProviderProfilesPage(1);
    // Clear repo-scoped auto-generated PATs when switching repositories. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
    setRepoTaskGroupTokens([]);
    setRepoTaskGroupTokenRevokingId(null);
    // Reset task-group token pagination on repo switch to avoid empty pages in the dedicated tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    setRepoTaskGroupTokensPage(1);
  }, [repoId]);

  useEffect(() => {
    // Clamp credential pagination when profiles are added/removed so the current page always has content when possible. u55e45ffi8jng44erdzp
    const repoProfilesTotal = (repoScopedCredentials?.repoProvider?.profiles ?? []).length;
    const repoMaxPage = Math.max(1, Math.ceil(repoProfilesTotal / CREDENTIAL_PROFILE_PAGE_SIZE));
    setRepoProviderProfilesPage((p) => Math.min(p, repoMaxPage));

    // Clamp unified model profile pagination when the list size changes. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
    const modelProfilesTotal = modelProviderProfileItems.length;
    const modelMaxPage = Math.max(1, Math.ceil(modelProfilesTotal / CREDENTIAL_PROFILE_PAGE_SIZE));
    setModelProviderProfilesPage((p) => Math.min(p, modelMaxPage));
    // Clamp task-group token pagination when the list size changes in the dedicated tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302
    const tokenMaxPage = Math.max(1, Math.ceil(repoTaskGroupTokens.length / TASK_GROUP_TOKEN_PAGE_SIZE));
    setRepoTaskGroupTokensPage((p) => Math.min(p, tokenMaxPage));
  }, [modelProviderProfileItems, repoScopedCredentials, repoTaskGroupTokens]);

  const [repoProviderProfileModalOpen, setRepoProviderProfileModalOpen] = useState(false);
  const [repoProviderProfileEditing, setRepoProviderProfileEditing] = useState<UserRepoProviderCredentialProfilePublic | null>(null);
  const [repoProviderProfileSubmitting, setRepoProviderProfileSubmitting] = useState(false);
  const [repoProviderTokenMode, setRepoProviderTokenMode] = useState<'keep' | 'set'>('keep');
  // Track default toggle inside the repo credential manage dialog. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
  const [repoProviderSetDefault, setRepoProviderSetDefault] = useState(false);
  const [repoProviderProfileForm] = Form.useForm<{ remark: string; token?: string; cloneUsername?: string }>();

  const [modelProfileModalOpen, setModelProfileModalOpen] = useState(false);
  const [modelProfileProvider, setModelProfileProvider] = useState<ModelProviderKey>('codex');
  const [modelProfileEditing, setModelProfileEditing] = useState<UserModelProviderCredentialProfilePublic | null>(null);
  const [modelProfileSubmitting, setModelProfileSubmitting] = useState(false);
  const [modelProfileApiKeyMode, setModelProfileApiKeyMode] = useState<'keep' | 'set'>('keep');
  // Track default toggle inside the model credential manage dialog. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
  const [modelProfileSetDefault, setModelProfileSetDefault] = useState(false);
  const [modelProfileForm] = Form.useForm<{ remark: string; apiKey?: string; apiBaseUrl?: string }>();

  const [robotModalOpen, setRobotModalOpen] = useState(false);
  const [robotSubmitting, setRobotSubmitting] = useState(false);
  const [editingRobot, setEditingRobot] = useState<RepoRobot | null>(null);
  const [robotChangingToken, setRobotChangingToken] = useState(false);
  const [robotChangingModelApiKey, setRobotChangingModelApiKey] = useState(false);
  const [robotTestingId, setRobotTestingId] = useState<string | null>(null);
  // Track workflow check loading state per robot in the settings modal. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
  const [robotWorkflowTestingId, setRobotWorkflowTestingId] = useState<string | null>(null);
  const [robotTogglingId, setRobotTogglingId] = useState<string | null>(null);
  const [robotDeletingId, setRobotDeletingId] = useState<string | null>(null);

  const [userModelCredentials, setUserModelCredentials] = useState<UserModelCredentialsPublic | null>(null);
  const [userModelCredentialsLoading, setUserModelCredentialsLoading] = useState(false);
  const [userModelCredentialsError, setUserModelCredentialsError] = useState(false);

  const [basicForm] = Form.useForm<{ name: string; externalId?: string; apiBaseUrl?: string; enabled: boolean }>();
  const [robotForm] = Form.useForm<RobotFormValues>();

  const watchedRepoCredentialSource = Form.useWatch('repoCredentialSource', robotForm);
  const watchedRepoCredentialProfileId = Form.useWatch('repoCredentialProfileId', robotForm);
  const watchedModelProvider = Form.useWatch('modelProvider', robotForm);
  const watchedModelCredentialSource = Form.useWatch(['modelProviderConfig', 'credentialSource'], robotForm);
  const watchedModelCredentialProfileId = Form.useWatch(['modelProviderConfig', 'credentialProfileId'], robotForm);

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
    // Business intent: reuse the shared webhook URL formatter so RepoDetail and Create modal stay consistent. (Change record: 2026-01-15)
    return webhookPath ? buildWebhookUrl(webhookPath) : '';
  }, [webhookPath]);

  const webhookVerified = Boolean(repo?.webhookVerifiedAt);

  // Map preview config reason codes to localized helper text. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const previewConfigReasonText = useMemo(() => {
    const reason = previewConfig?.reason;
    if (!reason) return '';
    if (reason === 'no_workspace') return t('repos.preview.reason.noWorkspace');
    if (reason === 'config_missing') return t('repos.preview.reason.configMissing');
    if (reason === 'config_invalid') return t('repos.preview.reason.configInvalid');
    if (reason === 'workspace_missing') return t('repos.preview.reason.workspaceMissing');
    return '';
  }, [previewConfig?.reason, t]);

  const activePreviewGroups = useMemo(
    // Keep repo-level preview management rendering resilient when older API responses omit active groups. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
    () => (Array.isArray(previewConfig?.activeTaskGroups) ? previewConfig.activeTaskGroups : []),
    [previewConfig?.activeTaskGroups]
  );

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

  // Format nullable API token timestamps for the repo task-group PAT list. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
  const formatTokenTime = useCallback((value?: string | null): string => {
    if (!value) return '-';
    return formatTime(value);
  }, [formatTime]);

  // Build role options for member/invite management. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const roleOptions = useMemo(
    () => [
      { value: 'owner' as RepoRole, label: t('repos.members.role.owner'), disabled: !canDeleteRepo },
      { value: 'maintainer' as RepoRole, label: t('repos.members.role.maintainer') },
      { value: 'member' as RepoRole, label: t('repos.members.role.member') }
    ],
    [canDeleteRepo, t]
  );

  // Derive invite status tags for the invite list. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const resolveInviteStatus = useCallback(
    (invite: RepoInvite): { key: string; color: string } => {
      if (invite.revokedAt) return { key: 'revoked', color: 'red' };
      if (invite.acceptedAt) return { key: 'accepted', color: 'green' };
      const expiresAt = invite.expiresAt ? new Date(invite.expiresAt).getTime() : 0;
      if (expiresAt && expiresAt <= Date.now()) return { key: 'expired', color: 'orange' };
      return { key: 'pending', color: 'blue' };
    },
    []
  );

  const refreshPreviewConfig = useCallback(async () => {
    // Load repo preview configuration metadata for the dashboard card. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
    if (!repoId) return;
    setPreviewConfigLoading(true);
    try {
      const data = await fetchRepoPreviewConfig(repoId);
      setPreviewConfig(data);
    } catch (err) {
      console.error(err);
      setPreviewConfig(null);
    } finally {
      setPreviewConfigLoading(false);
    }
  }, [repoId]);

  const refreshSkillSelection = useCallback(async () => {
    // Load repo-level skill defaults for the selection panel. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    if (!repoId) return;
    setSkillSelectionLoading(true);
    try {
      const selection = await fetchRepoSkillSelection(repoId);
      setSkillSelection(selection);
    } catch (err) {
      console.error(err);
      message.error(t('skills.selection.toast.fetchFailed'));
      setSkillSelection(null);
    } finally {
      setSkillSelectionLoading(false);
    }
  }, [message, repoId, t]);

  const saveSkillSelection = useCallback(
    async (nextSelection: SkillSelectionKey[] | null) => {
      // Persist repo-level skill defaults from the selection panel. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
      if (!repoId) return;
      setSkillSelectionSaving(true);
      try {
        const updated = await updateRepoSkillSelection(repoId, nextSelection);
        setSkillSelection(updated);
        message.success(t('skills.selection.toast.saved'));
      } catch (err) {
        console.error(err);
        message.error(t('skills.selection.toast.saveFailed'));
      } finally {
        setSkillSelectionSaving(false);
      }
    },
    [message, repoId, t]
  );

  const refreshRepoTaskGroupTokens = useCallback(async () => {
    // Load task-group PATs scoped to this repo by matching task-group ids. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
    if (!repoId) return;
    setRepoTaskGroupTokensLoading(true);
    try {
      const [tokens, taskGroupsResponse] = await Promise.all([
        fetchMyApiTokens(),
        fetchTaskGroups({ repoId, archived: 'all', limit: 200 })
      ]);
      // Unwrap task-group list payload from paginated response. docs/en/developer/plans/pagination-impl-20260227/task_plan.md pagination-impl-20260227
      const taskGroups = taskGroupsResponse.taskGroups;
      const taskGroupIds = new Set((taskGroups ?? []).map((group: TaskGroup) => group.id));
      const filtered = (Array.isArray(tokens) ? tokens : []).filter((token) => {
        const groupId = extractTaskGroupIdFromTokenName(token.name);
        return Boolean(groupId && taskGroupIds.has(groupId));
      });
      setRepoTaskGroupTokens(filtered);
    } catch (err) {
      console.error(err);
      setRepoTaskGroupTokens([]);
    } finally {
      setRepoTaskGroupTokensLoading(false);
    }
  }, [repoId]);

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
      setPreviewEnvConfig(data.previewEnvConfig ?? null); // Sync preview env config into repo detail state. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302

      basicForm.setFieldsValue({
        name: data.repo?.name ?? '',
        externalId: data.repo?.externalId ?? '',
        apiBaseUrl: data.repo?.apiBaseUrl ?? '',
        enabled: Boolean(data.repo?.enabled)
      });
    } catch (err) {
      console.error(err);
      message.error(t('toast.repos.detailFetchFailed'));
      setRepo(null);
      setRobots([]);
      setAutomationConfig(null);
      setWebhookSecret(null);
      setWebhookPathRaw(null);
      setRepoScopedCredentials(null);
      setPreviewEnvConfig(null); // Clear preview env config state when repo fetch fails. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
    } finally {
      setLoading(false);
    }
  }, [basicForm, message, repoId, t]);

  const revokeRepoTaskGroupToken = useCallback(
    async (token: UserApiTokenPublic) => {
      // Allow revoking auto-generated task-group PATs from the repo credentials card. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
      if (!token?.id || repoTaskGroupTokenRevokingId) return;
      setRepoTaskGroupTokenRevokingId(token.id);
      try {
        await revokeMyApiToken(token.id);
        message.success(t('toast.apiTokens.revoked'));
        await refreshRepoTaskGroupTokens();
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.apiTokens.saveFailed'));
      } finally {
        setRepoTaskGroupTokenRevokingId(null);
      }
    },
    [message, refreshRepoTaskGroupTokens, repoTaskGroupTokenRevokingId, t]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void refreshPreviewConfig();
  }, [refreshPreviewConfig]);

  useEffect(() => {
    void refreshSkillSelection();
    void refreshSkillsCatalog();
  }, [refreshSkillSelection, refreshSkillsCatalog]);

  useEffect(() => {
    // Keep repo task-group PATs in sync on repo changes. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204
    void refreshRepoTaskGroupTokens();
  }, [refreshRepoTaskGroupTokens]);

  useEffect(() => {
    // Keep onboarding visibility aligned with the current repo id (hash route may change without a full reload). 58w1q3n5nr58flmempxe
    setOnboardingOpen(!getOnboardingDone(repoId));
  }, [repoId]);

  useEffect(() => {
    // Business intent: hide the webhook secret after reloads or secret rotations unless the user re-opens it. (Change record: 2026-01-15)
    setShowWebhookSecretInline(false);
  }, [webhookSecret]);

  const handleSaveBasic = useCallback(async () => {
    // Block basic repo saves when repo is read-only or user lacks manage rights. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (!repoId || basicSaving || repoReadOnly) return;
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
  }, [basicForm, basicSaving, message, refresh, repo?.name, repoId, repoReadOnly, t]);

  // Archive/unarchive controls live in the repo basic panel to keep the Archive area discoverable. qnp1mtxhzikhbi0xspbc
  const handleArchiveRepo = useCallback(async () => {
    if (!repoId || repoArchiving) return;
    // Enforce manage permission before archiving. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (!canManageRepo) {
      message.error(t('repos.permissions.manageRequired'));
      return;
    }
    setRepoArchiving(true);
    try {
      await archiveRepo(repoId);
      message.success(t('toast.repos.archiveSuccess'));
      await refresh();
    } catch (err) {
      console.error(err);
      message.error(t('toast.repos.archiveFailed'));
    } finally {
      setRepoArchiving(false);
    }
  }, [canManageRepo, message, refresh, repoArchiving, repoId, t]);

  const handleUnarchiveRepo = useCallback(async () => {
    if (!repoId || repoUnarchiving) return;
    // Enforce manage permission before unarchiving. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (!canManageRepo) {
      message.error(t('repos.permissions.manageRequired'));
      return;
    }
    setRepoUnarchiving(true);
    try {
      await unarchiveRepo(repoId);
      message.success(t('toast.repos.unarchiveSuccess'));
      await refresh();
    } catch (err) {
      console.error(err);
      message.error(t('toast.repos.unarchiveFailed'));
    } finally {
      setRepoUnarchiving(false);
    }
  }, [canManageRepo, message, refresh, repoId, repoUnarchiving, t]);

  // Delete repo with RBAC gating for owner/admin only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const handleDeleteRepo = useCallback(async () => {
    if (!repoId || repoDeleting) return;
    if (!canDeleteRepo) {
      message.error(t('repos.permissions.deleteRequired'));
      return;
    }
    setRepoDeleting(true);
    try {
      await deleteRepo(repoId);
      message.success(t('toast.repos.deleteSuccess'));
      window.location.hash = buildReposHash();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || t('toast.repos.deleteFailed'));
    } finally {
      setRepoDeleting(false);
    }
  }, [canDeleteRepo, message, repoDeleting, repoId, t]);

  // Load/manage repo members and invites for the members panel. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  const refreshMembers = useCallback(async () => {
    if (!repoId || !canManageMembers) return;
    setMembersLoading(true);
    try {
      const data = await listRepoMembers(repoId);
      setMembers(data);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || t('toast.repos.membersFetchFailed'));
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, [canManageMembers, message, repoId, t]);

  const refreshInvites = useCallback(async () => {
    if (!repoId || !canManageMembers) return;
    setInvitesLoading(true);
    try {
      const data = await listRepoInvites(repoId);
      setInvites(data);
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || t('toast.repos.invitesFetchFailed'));
      setInvites([]);
    } finally {
      setInvitesLoading(false);
    }
  }, [canManageMembers, message, repoId, t]);

  useEffect(() => {
    // Fetch members + invites when the repo or permissions change. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (!canManageMembers) return;
    void refreshMembers();
    void refreshInvites();
  }, [canManageMembers, refreshInvites, refreshMembers]);

  const handleInviteSubmit = useCallback(async () => {
    if (!repoId || inviteSubmitting) return;
    // Require manage-members permission before sending invites. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (!canManageMembers) return;
    try {
      const values = await inviteForm.validateFields();
      setInviteSubmitting(true);
      await createRepoInvite(repoId, { email: values.email, role: values.role });
      message.success(t('toast.repos.inviteSent'));
      inviteForm.resetFields();
      await refreshInvites();
    } catch (err: any) {
      console.error(err);
      message.error(err?.response?.data?.error || t('toast.repos.inviteSendFailed'));
    } finally {
      setInviteSubmitting(false);
    }
  }, [canManageMembers, inviteForm, inviteSubmitting, message, refreshInvites, repoId, t]);

  const handleUpdateMemberRole = useCallback(
    async (member: RepoMember, role: RepoRole) => {
      if (!repoId || memberUpdatingId) return;
      // Require manage-members permission before role changes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (!canManageMembers) return;
      setMemberUpdatingId(member.userId);
      try {
        await updateRepoMemberRole(repoId, member.userId, role);
        message.success(t('toast.repos.memberUpdated'));
        await refreshMembers();
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.memberUpdateFailed'));
      } finally {
        setMemberUpdatingId(null);
      }
    },
    [canManageMembers, memberUpdatingId, message, refreshMembers, repoId, t]
  );

  const handleRemoveMember = useCallback(
    async (member: RepoMember) => {
      if (!repoId || memberRemovingId) return;
      // Require manage-members permission before removing members. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (!canManageMembers) return;
      setMemberRemovingId(member.userId);
      try {
        await removeRepoMember(repoId, member.userId);
        message.success(t('toast.repos.memberRemoved'));
        await refreshMembers();
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.memberRemoveFailed'));
      } finally {
        setMemberRemovingId(null);
      }
    },
    [canManageMembers, memberRemovingId, message, refreshMembers, repoId, t]
  );

  const handleRevokeInvite = useCallback(
    async (invite: RepoInvite) => {
      if (!repoId || inviteRevokingId) return;
      // Require manage-members permission before revoking invites. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (!canManageMembers) return;
      setInviteRevokingId(invite.id);
      try {
        await revokeRepoInvite(repoId, invite.id);
        message.success(t('toast.repos.inviteRevoked'));
        await refreshInvites();
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.inviteRevokeFailed'));
      } finally {
        setInviteRevokingId(null);
      }
    },
    [canManageMembers, inviteRevokingId, message, refreshInvites, repoId, t]
  );

  const patchRepoScopedCredentials = useCallback(
    async (patch: Parameters<typeof updateRepo>[1]) => {
      // Business context: repo-scoped credentials (repo token + model provider keys) live on the repository record
      // and can contain multiple profiles, which robots can reference by `credentialProfileId`.
      // Block credential mutations when repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (!repoId || credentialsSaving || repoReadOnly) return null;
      setCredentialsSaving(true);
      try {
        const updated = await updateRepo(repoId, patch);
        setRepo(updated.repo);
        if (updated.repoScopedCredentials !== undefined) {
          setRepoScopedCredentials(updated.repoScopedCredentials ?? null);
        }
        message.success(t('toast.repos.saved'));
        return updated;
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
        return null;
      } finally {
        setCredentialsSaving(false);
      }
    },
    [credentialsSaving, message, repoId, repoReadOnly, t]
  );

  const handleSavePreviewEnv = useCallback(
    async (payload: { entries: Array<{ key: string; value?: string; secret?: boolean }>; removeKeys: string[] }) => {
      // Persist repo preview env variables for dev preview only. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302
      if (!repoId || previewEnvSaving || repoReadOnly) return;
      setPreviewEnvSaving(true);
      try {
        const updated = await updateRepo(repoId, { previewEnvConfig: payload });
        setRepo(updated.repo);
        if (updated.previewEnvConfig !== undefined) {
          setPreviewEnvConfig(updated.previewEnvConfig ?? null);
        }
        message.success(t('toast.repos.saved'));
      } catch (err: any) {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
      } finally {
        setPreviewEnvSaving(false);
      }
    },
    [message, previewEnvSaving, repoId, repoReadOnly, t]
  );

  const startEditRepoProviderProfile = useCallback(
    (profile?: UserRepoProviderCredentialProfilePublic | null) => {
      setRepoProviderProfileEditing(profile ?? null);
      setRepoProviderProfileModalOpen(true);

      const initialRemark = profile?.remark ?? '';
      const initialCloneUsername = profile?.cloneUsername ?? '';

      // UX: keep existing tokens by default (backend never returns raw tokens).
      setRepoProviderTokenMode(profile?.hasToken ? 'keep' : 'set');
      repoProviderProfileForm.setFieldsValue({ remark: initialRemark, cloneUsername: initialCloneUsername, token: '' });
      // Default selection now lives inside the manage modal for repo credentials. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      const defaultId = String(repoScopedCredentials?.repoProvider?.defaultProfileId ?? '').trim();
      setRepoProviderSetDefault(Boolean(profile?.id && profile.id === defaultId));
    },
    [repoProviderProfileForm, repoScopedCredentials?.repoProvider?.defaultProfileId]
  );

  const submitRepoProviderProfile = useCallback(async () => {
    if (repoProviderProfileSubmitting) return;
    try {
      const values = await repoProviderProfileForm.validateFields();
      setRepoProviderProfileSubmitting(true);

      const remark = String(values.remark ?? '').trim();
      const cloneUsername = String(values.cloneUsername ?? '').trim();
      const tokenValue = String(values.token ?? '').trim();
      const shouldSendToken = repoProviderTokenMode === 'set';

      const currentDefaultId = String(repoScopedCredentials?.repoProvider?.defaultProfileId ?? '').trim();
      // Generate a stable profile id so new defaults can be applied immediately. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      const profileId = repoProviderProfileEditing?.id ?? generateUuid();
      const payload = {
        id: profileId,
        remark: remark || null,
        cloneUsername: cloneUsername || null,
        ...(shouldSendToken ? { token: tokenValue ? tokenValue : null } : {})
      };

      const isEditingDefault = Boolean(repoProviderProfileEditing?.id && repoProviderProfileEditing.id === currentDefaultId);
      const updated = await patchRepoScopedCredentials({
        // Update default selection inside the manage modal alongside profile edits. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
        repoProviderCredential: {
          profiles: [payload],
          ...(repoProviderSetDefault ? { defaultProfileId: profileId } : isEditingDefault ? { defaultProfileId: null } : {})
        }
      });
      if (!updated) return;

      setRepoProviderProfileModalOpen(false);
      setRepoProviderProfileEditing(null);
    } catch (err: any) {
      if (err?.errorFields) {
        // Form validation error; no toast.
      } else {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
      }
    } finally {
      setRepoProviderProfileSubmitting(false);
    }
  }, [
    message,
    patchRepoScopedCredentials,
    repoProviderProfileEditing?.id,
    repoProviderProfileForm,
    repoProviderProfileSubmitting,
    repoProviderSetDefault,
    repoProviderTokenMode,
    repoScopedCredentials?.repoProvider?.defaultProfileId,
    t
  ]);

  const removeRepoProviderProfile = useCallback(
    (id: string) => {
      Modal.confirm({
        title: t('panel.credentials.profile.removeTitle'),
        content: t('panel.credentials.profile.removeDesc'),
        okText: t('panel.credentials.profile.removeOk'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        onOk: async () => {
          await patchRepoScopedCredentials({
            repoProviderCredential: { removeProfileIds: [id] }
          });
        }
      });
    },
    [patchRepoScopedCredentials, t]
  );

  const startEditModelProfile = useCallback(
    (provider?: ModelProviderKey, profile?: UserModelProviderCredentialProfilePublic | null) => {
      const nextProvider = provider ?? modelProfileProvider ?? 'codex';
      // Keep the model provider selection aligned with the unified list modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      setModelProfileProvider(nextProvider);
      setModelProfileEditing(profile ?? null);
      setModelProfileModalOpen(true);

      const initialRemark = profile?.remark ?? '';
      const initialApiBaseUrl = profile?.apiBaseUrl ?? '';

      // UX: keep existing keys by default (backend never returns raw apiKey).
      setModelProfileApiKeyMode(profile?.hasApiKey ? 'keep' : 'set');
      modelProfileForm.setFieldsValue({ remark: initialRemark, apiBaseUrl: initialApiBaseUrl, apiKey: '' });
      // Default selection now lives inside the manage modal for model credentials. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      const defaultId = String((repoScopedCredentials as any)?.modelProvider?.[nextProvider]?.defaultProfileId ?? '').trim();
      setModelProfileSetDefault(Boolean(profile?.id && profile.id === defaultId));
    },
    [modelProfileForm, modelProfileProvider, repoScopedCredentials]
  );

  const submitModelProfile = useCallback(async () => {
    if (modelProfileSubmitting) return;
    try {
      const values = await modelProfileForm.validateFields();
      setModelProfileSubmitting(true);

      const remark = String(values.remark ?? '').trim();
      const apiBaseUrl = String(values.apiBaseUrl ?? '').trim();
      const apiKey = String(values.apiKey ?? '').trim();
      const shouldSendApiKey = modelProfileApiKeyMode === 'set';

      const currentDefaultId = String((repoScopedCredentials as any)?.modelProvider?.[modelProfileProvider]?.defaultProfileId ?? '').trim();
      // Generate a stable profile id so new defaults can be applied immediately. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
      const profileId = modelProfileEditing?.id ?? generateUuid();
      const payload = {
        id: profileId,
        remark: remark || null,
        apiBaseUrl: apiBaseUrl || null,
        ...(shouldSendApiKey ? { apiKey: apiKey ? apiKey : null } : {})
      };

      const isEditingDefault = Boolean(modelProfileEditing?.id && modelProfileEditing.id === currentDefaultId);
      const updated = await patchRepoScopedCredentials({
        // Update default selection inside the manage modal alongside profile edits. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex
        modelProviderCredential: {
          [modelProfileProvider]: {
            profiles: [payload],
            ...(modelProfileSetDefault ? { defaultProfileId: profileId } : isEditingDefault ? { defaultProfileId: null } : {})
          }
        } as any
      });
      if (!updated) return;

      setModelProfileModalOpen(false);
      setModelProfileEditing(null);
    } catch (err: any) {
      if (err?.errorFields) {
        // Form validation error; no toast.
      } else {
        console.error(err);
        message.error(err?.response?.data?.error || t('toast.repos.saveFailed'));
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
    patchRepoScopedCredentials,
    repoScopedCredentials,
    t
  ]);

  const removeModelProviderProfile = useCallback(
    (provider: ModelProviderKey, id: string) => {
      Modal.confirm({
        title: t('panel.credentials.profile.removeTitle'),
        content: t('panel.credentials.profile.removeDesc'),
        okText: t('panel.credentials.profile.removeOk'),
        okButtonProps: { danger: true },
        cancelText: t('common.cancel'),
        onOk: async () => {
          await patchRepoScopedCredentials({
            modelProviderCredential: { [provider]: { removeProfileIds: [id] } } as any
          });
        }
      });
    },
    [patchRepoScopedCredentials, t]
  );

  useEffect(() => {
    // Preload account credentials for both the onboarding wizard and the robot editor modal. 58w1q3n5nr58flmempxe
    if (!robotModalOpen && !onboardingOpen) return;
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
  }, [onboardingOpen, robotModalOpen]);

  useEffect(() => {
    // UX: auto-pick a usable provider profile when users choose `repoCredentialSource=user/repo`.
    if (!robotModalOpen) return;
    if (!repo?.provider) return;

    const source = watchedRepoCredentialSource === 'robot' ? 'robot' : watchedRepoCredentialSource === 'repo' ? 'repo' : 'user';
    const currentProfileId = typeof watchedRepoCredentialProfileId === 'string' ? watchedRepoCredentialProfileId.trim() : '';

    if (source === 'robot') {
      if (currentProfileId) {
        robotForm.setFieldsValue({ repoCredentialProfileId: null });
      }
      return;
    }

    const providerCredentials =
      source === 'user'
        ? repo.provider === 'github'
          ? userModelCredentials?.github
          : userModelCredentials?.gitlab
        : repoScopedCredentials?.repoProvider;
    const profiles = providerCredentials?.profiles ?? [];
    const existing = currentProfileId ? profiles.find((p) => p.id === currentProfileId) ?? null : null;
    if (existing && existing.hasToken) return;

    const defaultId = String(providerCredentials?.defaultProfileId ?? '').trim();
    const defaultProfile = defaultId ? profiles.find((p) => p.id === defaultId) ?? null : null;
    const nextId = (defaultProfile && defaultProfile.hasToken ? defaultProfile.id : '') || (profiles.find((p) => p.hasToken)?.id ?? '');
    if (!nextId || nextId === currentProfileId) return;
    robotForm.setFieldsValue({ repoCredentialProfileId: nextId });
  }, [
    repo?.provider,
    repoScopedCredentials?.repoProvider,
    robotForm,
    robotModalOpen,
    userModelCredentials?.gitlab,
    userModelCredentials?.github,
    watchedRepoCredentialProfileId,
    watchedRepoCredentialSource
  ]);

  useEffect(() => {
    // UX: auto-pick a usable model credential profile when `credentialSource` is `user` or `repo`.
    if (!robotModalOpen) return;

    const providerRaw = String(watchedModelProvider ?? '').trim();
    const provider: ModelProviderKey =
      providerRaw === 'claude_code' ? 'claude_code' : providerRaw === 'gemini_cli' ? 'gemini_cli' : 'codex';

    const source = normalizeCredentialSource(watchedModelCredentialSource);
    const currentProfileId = typeof watchedModelCredentialProfileId === 'string' ? watchedModelCredentialProfileId.trim() : '';

    if (source === 'robot') {
      if (currentProfileId) {
        robotForm.setFieldsValue({ modelProviderConfig: { credentialProfileId: null } as any });
      }
      return;
    }

    const providerCredentials =
      source === 'user'
        ? ((userModelCredentials as any)?.[provider] as any)
        : ((repoScopedCredentials as any)?.modelProvider?.[provider] as any);
    const profiles = Array.isArray(providerCredentials?.profiles) ? providerCredentials.profiles : [];

    const existing = currentProfileId ? profiles.find((p: any) => p && p.id === currentProfileId) ?? null : null;
    if (existing && existing.hasApiKey) return;

    const defaultId = String(providerCredentials?.defaultProfileId ?? '').trim();
    const defaultProfile = defaultId ? profiles.find((p: any) => p && p.id === defaultId) ?? null : null;
    const nextId =
      (defaultProfile && defaultProfile.hasApiKey ? String(defaultProfile.id) : '') ||
      (profiles.find((p: any) => p && p.hasApiKey)?.id ?? '');
    if (!nextId || nextId === currentProfileId) return;

    robotForm.setFieldsValue({ modelProviderConfig: { credentialProfileId: String(nextId) } as any });
  }, [
    repoScopedCredentials?.modelProvider,
    robotForm,
    robotModalOpen,
    userModelCredentials,
    watchedModelCredentialProfileId,
    watchedModelCredentialSource,
    watchedModelProvider
  ]);

  const buildRobotInitialValues = useCallback(
    (robot?: RepoRobot | null): RobotFormValues => {
      const buildDefaultModelProviderConfig = (provider: string): RobotFormValues['modelProviderConfig'] => {
        if (provider === 'claude_code') {
          return {
            credentialSource: 'user',
            credentialProfileId: null,
            model: 'claude-sonnet-4-5-20250929',
            sandbox: 'read-only',
            sandbox_workspace_write: { network_access: false }
          } as any;
        }
        if (provider === 'gemini_cli') {
          return {
            credentialSource: 'user',
            credentialProfileId: null,
            model: 'gemini-2.5-pro',
            sandbox: 'read-only',
            sandbox_workspace_write: { network_access: false }
          } as any;
        }
        return {
          credentialSource: 'user',
          credentialProfileId: null,
          model: 'gpt-5.2',
          sandbox: 'read-only',
          // Codex defaults omit network access since it is always enabled now. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
          model_reasoning_effort: 'medium'
        } as any;
      };

      const base: RobotFormValues = {
        name: '',
        repoCredentialSource: 'robot',
        repoCredentialProfileId: null,
        repoCredentialRemark: null,
        token: '',
        cloneUsername: '',
        promptDefault: '',
        language: locale,
        defaultBranch: null,
        // Default new robots to auto workflow (follow existing behavior). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflowMode: 'auto',
        // Default to no scheduling window until explicitly configured. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        timeWindow: null,
        isDefault: false,
        // Default dependency overrides to "inherit" so robots follow `.hookcode.yml` unless explicitly changed. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
        dependencyOverride: false,
        dependencyConfig: {
          enabled: true,
          failureMode: 'inherit',
          allowCustomInstall: false
        },
        modelProvider: 'codex',
        modelProviderConfig: buildDefaultModelProviderConfig('codex')
      };

      if (!robot) return base;

      const modelProvider = String(robot.modelProvider ?? 'codex').trim() || 'codex';
      const cfg = (robot.modelProviderConfig ?? {}) as any;
      const repoCredentialSource = (() => {
        const explicit = String(robot.repoCredentialSource ?? '').trim();
        if (explicit === 'robot' || explicit === 'user' || explicit === 'repo') return explicit;
        return robot.hasToken ? 'robot' : robot.repoCredentialProfileId ? 'user' : 'repo';
      })();
      const providerDefaults = buildDefaultModelProviderConfig(modelProvider);
      const credentialSource = normalizeCredentialSource(cfg?.credentialSource ?? providerDefaults.credentialSource);
      const credentialProfileId =
        credentialSource === 'robot' ? null : typeof cfg?.credentialProfileId === 'string' ? cfg.credentialProfileId.trim() || null : null;

      // Normalize dependency override fields from the robot payload for the editor state. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
      const dependencyOverride = Boolean(robot.dependencyConfig);
      const dependencyConfig = (robot.dependencyConfig ?? {}) as any;
      const dependencyFailureMode =
        dependencyConfig.failureMode === 'soft' || dependencyConfig.failureMode === 'hard' ? dependencyConfig.failureMode : 'inherit';

      return {
        ...base,
        name: robot.name || robot.id,
        repoCredentialSource,
        repoCredentialProfileId: repoCredentialSource === 'robot' ? null : robot.repoCredentialProfileId ?? null,
        repoCredentialRemark: repoCredentialSource === 'robot' ? robot.repoCredentialRemark ?? null : null,
        token: '',
        cloneUsername: repoCredentialSource === 'robot' ? robot.cloneUsername ?? '' : '',
        promptDefault: robot.promptDefault ?? '',
        language: typeof robot.language === 'string' && robot.language.trim() ? robot.language.trim() : locale,
        defaultBranch: robot.defaultBranch ?? null,
        // Populate workflow mode from the robot record (fallback to auto). docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        repoWorkflowMode: (robot.repoWorkflowMode ?? 'auto') as any,
        // Hydrate robot-level time windows into the editor state. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
        timeWindow: robot.timeWindow ?? null,
        isDefault: Boolean(robot.isDefault),
        // Hydrate dependency overrides from the robot record to keep the editor consistent. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
        dependencyOverride,
        dependencyConfig: {
          enabled: dependencyConfig.enabled === undefined ? true : Boolean(dependencyConfig.enabled),
          failureMode: dependencyFailureMode,
          allowCustomInstall: Boolean(dependencyConfig.allowCustomInstall)
        },
        modelProvider: modelProvider as any,
        modelProviderConfig: {
          credentialSource,
          credentialProfileId,
          credential:
            credentialSource === 'robot'
              ? {
                  apiKey: '',
                  hasApiKey: Boolean(cfg?.credential?.hasApiKey),
                  apiBaseUrl: typeof cfg?.credential?.apiBaseUrl === 'string' ? cfg.credential.apiBaseUrl : '',
                  remark: typeof cfg?.credential?.remark === 'string' ? cfg.credential.remark : ''
                }
              : undefined,
          model: cfg?.model ?? providerDefaults.model,
          sandbox: cfg?.sandbox ?? providerDefaults.sandbox,
          // Only non-Codex providers keep network access in config; Codex is always enabled. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
          ...(modelProvider === 'codex'
            ? { model_reasoning_effort: cfg?.model_reasoning_effort ?? (providerDefaults as any).model_reasoning_effort }
            : {
                sandbox_workspace_write: {
                  network_access: Boolean(cfg?.sandbox_workspace_write?.network_access ?? providerDefaults?.sandbox_workspace_write?.network_access)
                }
              })
        }
      };
    },
    [locale]
  );

  const openCreateRobot = useCallback(() => {
    // Block robot creation when the repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    if (repoReadOnly) return;
    setEditingRobot(null);
    setRobotChangingToken(false);
    setRobotChangingModelApiKey(false);
    setRobotModalOpen(true);
    robotForm.setFieldsValue(buildRobotInitialValues(null));
  }, [buildRobotInitialValues, repoReadOnly, robotForm]);

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
      // Block robot mutations when repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (!repo || repoReadOnly) return;
      // Allow configuring robots without requiring webhook verification (webhooks are optional). 58w1q3n5nr58flmempxe

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

        // Repo provider credential validation (GitLab/GitHub token).
        if (repoCredentialSource === 'user' || repoCredentialSource === 'repo') {
          if (!repoCredentialProfileId) {
            message.warning(t('repos.robotForm.repoCredential.profileRequired'));
            return;
          }

          const providerCredentials =
            repoCredentialSource === 'user'
              ? repo.provider === 'github'
                ? userModelCredentials?.github
                : userModelCredentials?.gitlab
              : repoScopedCredentials?.repoProvider;
          const profiles = providerCredentials?.profiles ?? [];

          if (repoCredentialSource === 'repo' && !profiles.some((p) => p.hasToken)) {
            message.warning(t('repos.robotForm.repoCredential.repoNotConfigured'));
            return;
          }

          const selected = profiles.find((p) => p.id === repoCredentialProfileId) ?? null;
          if (!selected) {
            message.warning(t('repos.robotForm.repoCredential.profileNotFound'));
            return;
          }
          if (!selected.hasToken) {
            message.warning(t('repos.robotForm.repoCredential.profileTokenMissing'));
            return;
          }
        } else if (repoCredentialSource === 'robot') {
          const needsToken = !editingRobot || !editingRobot.hasToken || robotChangingToken;
          if (needsToken && !tokenValue) {
            message.warning(t('repos.robotForm.repoCredential.tokenRequired'));
            return;
          }
        }

        const modelCredentialProfileId = typeof cfg?.credentialProfileId === 'string' ? cfg.credentialProfileId.trim() : '';

        // Model provider credential validation (codex / claude_code / gemini_cli).
        if (credentialSource === 'user' || credentialSource === 'repo') {
          const providerCredentials =
            credentialSource === 'user'
              ? ((userModelCredentials as any)?.[normalizedModelProvider] as any)
              : ((repoScopedCredentials as any)?.modelProvider?.[normalizedModelProvider] as any);
          const profiles = Array.isArray(providerCredentials?.profiles) ? providerCredentials.profiles : [];
          const hasAnyApiKey = profiles.some((p: any) => p && p.hasApiKey);

          if (!hasAnyApiKey) {
            const key =
              credentialSource === 'repo'
                ? normalizedModelProvider === 'codex'
                  ? 'repos.robotForm.modelCredential.repoNotConfigured'
                  : normalizedModelProvider === 'claude_code'
                    ? 'repos.robotForm.modelCredential.repoNotConfigured.claude_code'
                    : 'repos.robotForm.modelCredential.repoNotConfigured.gemini_cli'
                : normalizedModelProvider === 'codex'
                  ? 'repos.robotForm.modelCredential.userNotConfigured'
                  : normalizedModelProvider === 'claude_code'
                    ? 'repos.robotForm.modelCredential.userNotConfigured.claude_code'
                    : 'repos.robotForm.modelCredential.userNotConfigured.gemini_cli';
            message.warning(t(key));
            return;
          }

          if (!modelCredentialProfileId) {
            message.warning(t('repos.robotForm.modelCredential.profileRequired'));
            return;
          }

          const selected = profiles.find((p: any) => p && p.id === modelCredentialProfileId) ?? null;
          if (!selected) {
            message.warning(t('repos.robotForm.modelCredential.profileNotFound'));
            return;
          }
          if (!selected.hasApiKey) {
            message.warning(t('repos.robotForm.modelCredential.profileApiKeyMissing'));
            return;
          }
        }

        const editingRobotHasApiKey = Boolean(
          editingRobot && String(editingRobot.modelProvider ?? '').trim() === normalizedModelProvider && (editingRobot.modelProviderConfig as any)?.credential?.hasApiKey
        );
        const apiBaseUrl =
          credentialSource === 'robot' && typeof cfg?.credential?.apiBaseUrl === 'string' ? cfg.credential.apiBaseUrl.trim() : '';
        const modelCredentialRemark =
          credentialSource === 'robot' && typeof cfg?.credential?.remark === 'string' ? cfg.credential.remark.trim() : '';
        const apiKey =
          credentialSource === 'robot' && typeof cfg?.credential?.apiKey === 'string' ? cfg.credential.apiKey.trim() : '';
        const shouldSendModelApiKey =
          credentialSource === 'robot' && (!editingRobot || robotChangingModelApiKey || !editingRobotHasApiKey);

        // Persist the selected repo workflow mode so the backend can enforce direct/fork. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
        const workflowMode = values.repoWorkflowMode ?? 'auto';
        // Map dependency override UI fields into API payload for robot-level install control. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124
        const dependencyOverride = Boolean(values.dependencyOverride);
        const dependencyFailureMode = values.dependencyConfig?.failureMode;
        const dependencyConfig = dependencyOverride
          ? {
              enabled: Boolean(values.dependencyConfig?.enabled),
              allowCustomInstall: Boolean(values.dependencyConfig?.allowCustomInstall),
              ...(dependencyFailureMode === 'soft' || dependencyFailureMode === 'hard' ? { failureMode: dependencyFailureMode } : {})
            }
          : null;
        const payload: any = {
          name: values.name,
          ...(shouldSendToken ? { token: repoCredentialSource === 'robot' ? tokenValue : null } : {}),
          cloneUsername: repoCredentialSource === 'robot' ? (values.cloneUsername?.trim() ? values.cloneUsername.trim() : null) : null,
          repoCredentialSource,
          repoCredentialProfileId: repoCredentialSource === 'robot' ? null : repoCredentialProfileId,
          // Change record (2026-01-15): only send repoCredentialRemark when repoCredentialSource=robot to satisfy backend validation.
          repoCredentialRemark:
            repoCredentialSource === 'robot' ? (values.repoCredentialRemark?.trim() ? values.repoCredentialRemark.trim() : null) : undefined,
          promptDefault: promptDefaultValue,
          language: values.language?.trim() ? values.language.trim() : null,
          modelProvider: normalizedModelProvider,
          modelProviderConfig: isCodex
            ? {
                credentialSource,
                credentialProfileId: credentialSource === 'robot' ? undefined : modelCredentialProfileId,
                credential:
                  credentialSource === 'robot'
                    ? {
                        apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
                        remark: modelCredentialRemark ? modelCredentialRemark : undefined,
                        ...(shouldSendModelApiKey ? { apiKey: apiKey ? apiKey : undefined } : {})
                      }
                    : undefined,
                model: cfg.model,
                sandbox: normalizeCodexSandbox(cfg.sandbox),
                // Codex payload omits network access because it is always enabled. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
                model_reasoning_effort: normalizeCodexReasoningEffort(cfg.model_reasoning_effort)
              }
            : {
                credentialSource,
                credentialProfileId: credentialSource === 'robot' ? undefined : modelCredentialProfileId,
                credential:
                  credentialSource === 'robot'
                    ? {
                        apiBaseUrl: apiBaseUrl ? apiBaseUrl : undefined,
                        remark: modelCredentialRemark ? modelCredentialRemark : undefined,
                        ...(shouldSendModelApiKey ? { apiKey: apiKey ? apiKey : undefined } : {})
                      }
                    : undefined,
                model: String(cfg.model ?? '').trim(),
                sandbox: normalizeCodexSandbox(cfg.sandbox),
                sandbox_workspace_write: { network_access: Boolean(cfg?.sandbox_workspace_write?.network_access) }
              },
          defaultBranch: values.defaultBranch === undefined ? undefined : values.defaultBranch,
          repoWorkflowMode: workflowMode,
          // Persist robot-level time windows for scheduling. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
          timeWindow: values.timeWindow ?? null,
          dependencyConfig,
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
      repoReadOnly,
      repoScopedCredentials,
      robotChangingModelApiKey,
      robotChangingToken,
      t,
      userModelCredentials
    ]
  );

  const handleTestRobot = useCallback(
    async (robot: RepoRobot) => {
      if (!repo || repoReadOnly) return; // Block robot activation tests for read-only repos. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      // Allow robot activation tests even when webhooks are not configured yet. 58w1q3n5nr58flmempxe
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
    [message, repo, repoReadOnly, t]
  );

  const handleTestRobotWorkflow = useCallback(
    async () => {
      // Validate the selected repo workflow mode using the saved robot credentials. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124
      if (!repo || repoReadOnly) return; // Block workflow checks for read-only repos. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      if (!editingRobot?.id) {
        message.warning(t('repos.robotForm.workflowMode.saveRequired'));
        return;
      }
      const modeRaw = robotForm.getFieldValue('repoWorkflowMode');
      const mode = modeRaw === 'direct' || modeRaw === 'fork' || modeRaw === 'auto' ? modeRaw : 'auto';
      setRobotWorkflowTestingId(editingRobot.id);
      try {
        const result = await testRepoRobotWorkflow(repo.id, editingRobot.id, { mode });
        if (result.ok) {
          message.success(t('repos.robotForm.workflowMode.checkOk'));
        } else {
          message.warning(t('repos.robotForm.workflowMode.checkFailed', { message: result.message || 'unknown' }));
        }
      } catch (err: any) {
        console.error(err);
        const detail = err?.response?.data?.error || err?.message || 'unknown';
        message.error(t('repos.robotForm.workflowMode.checkFailed', { message: detail }));
      } finally {
        setRobotWorkflowTestingId(null);
      }
    },
    [editingRobot, message, repo, repoReadOnly, robotForm, t]
  );

  const handleToggleRobotEnabled = useCallback(
    async (robot: RepoRobot) => {
      if (!repo || repoReadOnly) return; // Block enable/disable mutations for read-only repos. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      // Allow enabling/disabling robots without requiring webhook verification. 58w1q3n5nr58flmempxe
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
    [message, repo, repoReadOnly, t]
  );

  const handleDeleteRobot = useCallback(
    async (robot: RepoRobot) => {
      if (!repo || repoReadOnly) return; // Block robot deletion for read-only repos. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
      // Allow deleting robots without requiring webhook verification. 58w1q3n5nr58flmempxe

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
    [message, repo, repoReadOnly, t]
  );

  // Navigate to a specific repo sub-tab instead of scroll-to-section. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const navigateToTab = useCallback(
    (key: RepoTab) => {
      window.location.hash = buildRepoHash(repoId, key);
    },
    [repoId]
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
    openEditRobot(target);
    navigateToTab('robots');
  }, [fromRobotId, openEditRobot, robotsSorted, navigateToTab]);

  if (!repoId) {
    return (
      <div className="hc-page">
        <div className="hc-empty">
          <Empty description={t('repos.detail.missingId')} />
        </div>
      </div>
    );
  }

  // UX: keep PageNav actions minimal; section-level actions (save/test/create) should live inside each dashboard card. u55e45ffi8jng44erdzp
  const headerActions = undefined;

  // Only show PageNav back arrow when navigated from TaskDetail; sidebar handles normal "back to repos". docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const headerBack = useMemo(() => {
    if (typeof window === 'undefined') return undefined;
    if (!fromTaskId) return undefined; // Sidebar covers the "all repos" back flow
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
  }, [fromTaskId, t]);

  // Derive the current tab display name for the PageNav header. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const tabTitleKey = `repos.detail.tabs.${activeTab}` as const;

  // Render repo detail with sidebar sub-navigation layout. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  return (
    <>
      {/* Sidebar + page wrapper rendered as a horizontal flex row */}
      <div className="hc-repo-detail-layout">
        <RepoDetailSidebar
          repoId={repoId}
          repoName={repo?.name || title}
          provider={repo?.provider as 'github' | 'gitlab' | undefined}
          enabled={repo?.enabled ?? true}
          activeTab={activeTab}
        />
        <div className="hc-page hc-repo-detail-page" style={{ flex: 1, minWidth: 0 }}>
	        <PageNav
	          back={headerBack}
	          title={t(tabTitleKey as any) || title}
          meta={
            <Typography.Text type="secondary">
              {repo?.updatedAt ? t('repos.detail.updatedAt', { time: formatTime(repo.updatedAt) }) : ''}
            </Typography.Text>
          }
	          actions={headerActions}
	          navToggle={navToggle}
	          userPanel={userPanel}
	        />

	        <div className="hc-page__body">
          {repo ? (
            // Skip onboarding wizard for read-only repositories to avoid exposing edit flows. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
            onboardingOpen && !repoReadOnly ? (
              <RepoOnboardingWizard
                repo={repo}
                robots={robotsSorted}
                repoScopedCredentials={repoScopedCredentials}
                userModelCredentials={userModelCredentials}
                userModelCredentialsLoading={userModelCredentialsLoading}
                userModelCredentialsError={userModelCredentialsError}
                webhookUrl={webhookFullUrl || webhookPath}
                webhookSecret={webhookSecret}
                webhookVerifiedAt={repo.webhookVerifiedAt ?? null}
                onOpenRepoProviderCredential={() => startEditRepoProviderProfile(null)}
                onOpenCreateRobot={openCreateRobot}
                onOpenWebhookIntro={() => setWebhookIntroOpen(true)}
                onRefreshRepo={() => void refresh()}
                onSkip={() => {
                  markOnboardingDone(repo.id, 'skipped');
                  setOnboardingOpen(false);
                }}
                onFinish={() => {
                  markOnboardingDone(repo.id, 'completed');
                  setOnboardingOpen(false);
                }}
              />
            ) : (
              /* Tab-based content rendering: show only the active tab instead of all sections. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228 */
              <div className="hc-repo-tab-content">
                {/* ---------- OVERVIEW TAB ---------- */}
                {activeTab === 'overview' && (
                  <Space direction="vertical" size={16} style={{ width: '100%' }}>
                    <RepoDetailDashboardSummaryStrip
                      repo={repo}
                      robots={robotsSorted}
                      automationConfig={automationConfig}
                      repoScopedCredentials={repoScopedCredentials}
                      webhookVerified={webhookVerified}
                      webhookUrl={webhookFullUrl || webhookPath}
                      formatTime={formatTime}
                      providerLabel={providerLabel}
                      onJumpToSection={(key) => {
                        // Navigate to the corresponding tab when a summary strip section is clicked. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
                        const tabMap: Record<string, RepoTab> = {
                          basic: 'basic', branches: 'branches', credentials: 'credentials',
                          robots: 'robots', automation: 'automation', webhooks: 'webhooks',
                        };
                        const tab = tabMap[key];
                        if (tab) window.location.hash = buildRepoHash(repoId, tab);
                      }}
                    />
                    <RepoTaskActivityCard repoId={repo.id} />
                    <RepoDetailProviderActivityRow
                      repo={repo}
                      repoScopedCredentials={repoScopedCredentials}
                      userModelCredentials={userModelCredentials}
                      formatTime={formatTime}
                    />
                    {/* Preview configuration discovery — modern section style. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 */}
                    <div className="hc-section-block">
                      <div className="hc-section-block__header">
                        <span className="hc-section-block__title">{t('repos.preview.title')}</span>
                      </div>
                      <div className="hc-section-block__body">
                        {previewConfigLoading ? (
                          <Typography.Text type="secondary">{t('repos.preview.loading')}</Typography.Text>
                        ) : previewConfig?.available ? (
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Typography.Text type="secondary">{t('repos.preview.available')}</Typography.Text>
                            {previewConfig.instances.map((instance) => (
                              <div key={instance.name} className="hc-section-block__row">
                                <Tag color="blue">{instance.name}</Tag>
                                <Typography.Text code>{instance.workdir}</Typography.Text>
                              </div>
                            ))}
                          </Space>
                        ) : (
                          <Space direction="vertical" size={4}>
                            <Typography.Text type="secondary">{t('repos.preview.unavailable')}</Typography.Text>
                            {previewConfigReasonText ? (
                              <Typography.Text type="secondary">{previewConfigReasonText}</Typography.Text>
                            ) : null}
                          </Space>
                        )}
                        {/* Render repo-scoped active preview groups for runtime management visibility. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
                        {!previewConfigLoading ? (
                          <>
                            <Divider style={{ margin: '12px 0' }} />
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Typography.Text type="secondary">{t('repos.preview.activeGroups.title')}</Typography.Text>
                              {activePreviewGroups.length ? (
                                activePreviewGroups.map((group) => (
                                  <div key={group.taskGroupId} className="hc-section-block__row" style={{ alignItems: 'flex-start', gap: 8 }}>
                                    <Space direction="vertical" size={2}>
                                      <Space wrap>
                                        <Typography.Text strong>{group.taskGroupTitle || group.taskGroupId}</Typography.Text>
                                        <Typography.Text code>{group.taskGroupId}</Typography.Text>
                                        {group.repoId ? <Tag>{t('repos.preview.activeGroups.repo', { repoId: group.repoId })}</Tag> : null}
                                      </Space>
                                      <Space wrap>
                                        {group.instances.map((instance) => (
                                          <Tag
                                            key={`${group.taskGroupId}-${instance.name}`}
                                            color={
                                              instance.status === 'running'
                                                ? 'green'
                                                : instance.status === 'starting'
                                                  ? 'blue'
                                                  : instance.status === 'failed'
                                                    ? 'red'
                                                    : instance.status === 'timeout'
                                                      ? 'gold'
                                                      : 'default'
                                            }
                                          >
                                            {instance.name}: {t(`preview.status.${instance.status}` as any)}
                                            {instance.port ? ` (${instance.port})` : ''}
                                          </Tag>
                                        ))}
                                      </Space>
                                    </Space>
                                  </div>
                                ))
                              ) : (
                                <Typography.Text type="secondary">{t('repos.preview.activeGroups.empty')}</Typography.Text>
                              )}
                            </Space>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </Space>
                )}

                {/* ---------- BASIC TAB — modern section block. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'basic' && (
                  <div className="hc-section-block">
                    <div className="hc-section-block__header">
                      <span className="hc-section-block__title">{t('repos.detail.basicTitle')}</span>
                    </div>
                    <div className="hc-section-block__body">
                      {repoArchived ? (
                        <Alert type="warning" showIcon message={t('repos.archive.banner')} style={{ marginBottom: 12 }} />
                      ) : null}
                      <Form form={basicForm} layout="vertical" requiredMark={false} disabled={repoReadOnly}>
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
                      <div className="hc-section-block__actions">
                        {repoArchived ? (
                          <Popconfirm
                            title={t('repos.unarchive.confirmTitle')}
                            description={t('repos.unarchive.confirmDesc')}
                            okText={t('common.restore')}
                            cancelText={t('common.cancel')}
                            onConfirm={() => void handleUnarchiveRepo()}
                          >
                            <Button type="primary" loading={repoUnarchiving} disabled={loading || !canManageRepo}>
                              {t('common.restore')}
                            </Button>
                          </Popconfirm>
                        ) : (
                          <>
                            <Popconfirm
                              title={t('repos.archive.confirmTitle')}
                              description={t('repos.archive.confirmDesc')}
                              okText={t('repos.detail.archive')}
                              cancelText={t('common.cancel')}
                              onConfirm={() => void handleArchiveRepo()}
                            >
                              <Button danger loading={repoArchiving} disabled={loading || !canManageRepo}>
                                {t('repos.detail.archive')}
                              </Button>
                            </Popconfirm>
                            <Button
                              type="primary"
                              icon={<SaveOutlined />}
                              onClick={() => void handleSaveBasic()}
                              loading={basicSaving}
                              disabled={loading || repoReadOnly}
                            >
                              {t('common.save')}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------- BRANCHES TAB ---------- */}
                {activeTab === 'branches' && (
                  <RepoBranchesCard repo={repo} onSaved={(next) => setRepo(next)} readOnly={repoReadOnly} />
                )}

                {/* ---------- CREDENTIALS TAB — modern section blocks. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'credentials' && (
                  <div className="hc-section-stack">
                    <div className="hc-section-block">
                      <div className="hc-section-block__header">
                        <span className="hc-section-block__title"><GlobalOutlined />{t('repos.detail.credentials.repoProvider')}</span>
                        <div className="hc-section-block__extra">
                          <Button size="small" onClick={() => startEditRepoProviderProfile(null)} disabled={credentialsSaving || repoReadOnly}>
                            {t('panel.credentials.profile.add')}
                          </Button>
                        </div>
                      </div>
                      <div className="hc-section-block__body">
                        <Typography.Text type="secondary">{t('repos.detail.credentials.repoProviderTip')}</Typography.Text>
                        {(() => {
                          const profiles = repoScopedCredentials?.repoProvider?.profiles ?? [];
                          const total = profiles.length;
                          const defaultId = String(repoScopedCredentials?.repoProvider?.defaultProfileId ?? '').trim();
                          const start = (repoProviderProfilesPage - 1) * CREDENTIAL_PROFILE_PAGE_SIZE;
                          const paged = profiles.slice(start, start + CREDENTIAL_PROFILE_PAGE_SIZE);
                          if (!total) return <div style={{ marginTop: 8 }}><Typography.Text type="secondary">{t('panel.credentials.profile.empty')}</Typography.Text></div>;
                          return (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                {paged.map((p) => (
                                  <div key={p.id} className="hc-section-block__item">
                                    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                      <Space size={8} wrap>
                                        <Typography.Text strong>{p.remark || p.id}</Typography.Text>
                                        {defaultId === p.id ? <Tag color="blue">{t('panel.credentials.profile.defaultTag')}</Tag> : null}
                                        <Tag color={p.hasToken ? 'green' : 'default'}>{p.hasToken ? t('common.configured') : t('common.notConfigured')}</Tag>
                                      </Space>
                                      <Typography.Text type="secondary">{p.cloneUsername || '-'}</Typography.Text>
                                    </Space>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                      <Button size="small" onClick={() => startEditRepoProviderProfile(p)} disabled={credentialsSaving || repoReadOnly}>{t('common.manage')}</Button>
                                      <Button size="small" danger onClick={() => removeRepoProviderProfile(p.id)} disabled={credentialsSaving || repoReadOnly}>{t('panel.credentials.profile.remove')}</Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {total > CREDENTIAL_PROFILE_PAGE_SIZE ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                  <Pagination size="small" current={repoProviderProfilesPage} pageSize={CREDENTIAL_PROFILE_PAGE_SIZE} total={total} showSizeChanger={false} onChange={(page) => setRepoProviderProfilesPage(page)} />
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="hc-section-block">
                      <div className="hc-section-block__header">
                        <span className="hc-section-block__title"><KeyOutlined />{t('repos.detail.credentials.modelProvider')}</span>
                        <div className="hc-section-block__extra">
                          <Button size="small" onClick={() => startEditModelProfile(undefined, null)} disabled={credentialsSaving || repoReadOnly}>
                            {t('panel.credentials.profile.add')}
                          </Button>
                        </div>
                      </div>
                      <div className="hc-section-block__body">
                        <Typography.Text type="secondary">{t('repos.detail.credentials.modelProviderTip')}</Typography.Text>
                        {(() => {
                          const total = modelProviderProfileItems.length;
                          const start = (modelProviderProfilesPage - 1) * CREDENTIAL_PROFILE_PAGE_SIZE;
                          const paged = modelProviderProfileItems.slice(start, start + CREDENTIAL_PROFILE_PAGE_SIZE);
                          if (!total) return <div style={{ marginTop: 8 }}><Typography.Text type="secondary">{t('panel.credentials.profile.empty')}</Typography.Text></div>;
                          return (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                {paged.map(({ provider, profile, defaultId }) => (
                                  <div key={`${provider}-${profile.id}`} className="hc-section-block__item">
                                    <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                      <Space size={8} wrap>
                                        <Typography.Text strong>{profile.remark || profile.id}</Typography.Text>
                                        <Tag color="geekblue">{t(`repos.robotForm.modelProvider.${provider}` as any)}</Tag>
                                        {defaultId === profile.id ? <Tag color="blue">{t('panel.credentials.profile.defaultTag')}</Tag> : null}
                                        <Tag color={profile.hasApiKey ? 'green' : 'default'}>{profile.hasApiKey ? t('common.configured') : t('common.notConfigured')}</Tag>
                                      </Space>
                                      <Typography.Text type="secondary">{profile.apiBaseUrl || '-'}</Typography.Text>
                                    </Space>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                      <Button size="small" onClick={() => startEditModelProfile(provider, profile)} disabled={credentialsSaving || repoReadOnly}>{t('common.manage')}</Button>
                                      <Button size="small" danger onClick={() => removeModelProviderProfile(provider, profile.id)} disabled={credentialsSaving || repoReadOnly}>{t('panel.credentials.profile.remove')}</Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              {total > CREDENTIAL_PROFILE_PAGE_SIZE ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                  <Pagination size="small" current={modelProviderProfilesPage} pageSize={CREDENTIAL_PROFILE_PAGE_SIZE} total={total} showSizeChanger={false} onChange={(page) => setModelProviderProfilesPage(page)} />
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------- ENV TAB — preview-only env injection. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 ---------- */}
                {activeTab === 'env' && (
                  <RepoEnvConfigPanel
                    config={previewEnvConfig}
                    readOnly={repoReadOnly}
                    saving={previewEnvSaving}
                    onSave={handleSavePreviewEnv}
                  />
                )}

                {/* ---------- ROBOTS TAB — modern section block. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'robots' && (
                  <div className="hc-section-block">
                    <div className="hc-section-block__header">
                      <span className="hc-section-block__title">{t('repos.robots.title')}</span>
                      {!repoReadOnly && (
                        <div className="hc-section-block__extra">
                          <Button icon={<PlusOutlined />} onClick={openCreateRobot}>{t('repos.robots.createRobot')}</Button>
                        </div>
                      )}
                    </div>
                    <div className="hc-section-block__body">
                    {repoArchived ? <Alert type="warning" showIcon message={t('repos.archive.banner')} style={{ marginBottom: 12 }} /> : null}
                    {robotsSorted.length ? (
                      <ScrollableTable<RepoRobot>
                        size="small"
                        rowKey="id"
                        dataSource={robotsSorted}
                        pagination={{ pageSize: 16, showSizeChanger: true, pageSizeOptions: ['8', '16', '32'], hideOnSinglePage: true }}
                        columns={[
                          {
                            title: t('common.name'),
                            dataIndex: 'name',
                            render: (_: any, r: RepoRobot) => {
                              const pl = getRobotProviderLabel(r.modelProvider);
                              return (
                                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                  <Space size={6} wrap>
                                    <Typography.Text strong className="table-cell-ellipsis" title={r.name}>{r.name}</Typography.Text>
                                    {pl ? <Tag color="geekblue" style={{ fontSize: 11, lineHeight: '18px', marginInlineEnd: 0 }}>{pl}</Tag> : null}
                                  </Space>
                                  <Typography.Text type="secondary" className="table-cell-ellipsis" style={{ fontSize: 12 }} title={r.id}>{r.id}</Typography.Text>
                                </Space>
                              );
                            }
                          },
                          { title: t('common.status'), key: 'status', width: 140, render: (_: any, r: RepoRobot) => resolveRobotStatusTag(t, r) },
                          { title: t('repos.robots.permission'), dataIndex: 'permission', width: 120, render: (v: string) => <Tag color={v === 'write' ? 'volcano' : 'blue'}>{v}</Tag> },
                          { title: t('repos.robots.default'), dataIndex: 'isDefault', width: 110, render: (v: boolean) => (v ? <Tag color="blue">{t('repos.robots.default')}</Tag> : <Typography.Text type="secondary">-</Typography.Text>) },
                          {
                            title: t('repos.robots.lastTest'), key: 'lastTest', width: 220,
                            render: (_: any, r: RepoRobot) => {
                              if (!r.lastTestAt) return <Typography.Text type="secondary">-</Typography.Text>;
                              const ok = Boolean(r.lastTestOk);
                              return (
                                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{formatTime(r.lastTestAt)}</Typography.Text>
                                  <Typography.Text type={ok ? 'success' : 'danger'} style={{ fontSize: 12 }}>{ok ? t('repos.robots.test.ok') : t('repos.robots.test.notOk')}</Typography.Text>
                                </Space>
                              );
                            }
                          },
                          {
                            title: t('common.actions'), key: 'actions', width: 300,
                            render: (_: any, r: RepoRobot) => (
                              <Space size={8} wrap style={{ minWidth: 0 }}>
                                <Button size="small" onClick={() => openEditRobot(r)}>{repoReadOnly ? t('common.view') : t('common.edit')}</Button>
                                {!repoReadOnly ? (
                                  <>
                                    <Button size="small" onClick={() => void handleTestRobot(r)} loading={robotTestingId === r.id}>{t('repos.robots.test')}</Button>
                                    <Button size="small" onClick={() => void handleToggleRobotEnabled(r)} loading={robotTogglingId === r.id}>{r.enabled ? t('repos.robots.disable') : t('repos.robots.enable')}</Button>
                                    <Popconfirm title={t('repos.robots.deleteConfirmTitle')} description={t('repos.robots.deleteConfirmDesc')} okText={t('common.delete')} cancelText={t('common.cancel')} onConfirm={() => void handleDeleteRobot(r)}>
                                      <Button size="small" danger loading={robotDeletingId === r.id}>{t('common.delete')}</Button>
                                    </Popconfirm>
                                  </>
                                ) : null}
                              </Space>
                            )
                          }
                        ]}
                      />
                    ) : (
                      <Empty description={t('repos.detail.robotsEmpty')} />
                    )}
                    </div>
                  </div>
                )}

                {/* ---------- AUTOMATION TAB — modern section block. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'automation' && (
                  <div className="hc-section-block">
                    <div className="hc-section-block__header">
                      <span className="hc-section-block__title">{t('repos.automation.title')}</span>
                    </div>
                    <div className="hc-section-block__body">
                    {repoArchived ? <Alert type="warning" showIcon message={t('repos.archive.banner')} style={{ marginBottom: 12 }} /> : null}
                    <RepoAutomationPanel
                      repo={repo}
                      robots={robotsSorted}
                      value={automationConfig ?? defaultAutomationConfig()}
                      readOnly={repoReadOnly}
                      onChange={(next) => setAutomationConfig(next)}
                      onSave={async (next) => {
                        const saved = await updateRepoAutomation(repo.id, next);
                        setAutomationConfig(saved);
                      }}
                    />
                    </div>
                  </div>
                )}

                {/* ---------- SKILLS TAB — modern section block. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'skills' && (
                  <div className="hc-section-block">
                    <div className="hc-section-block__header">
                      <span className="hc-section-block__title">{t('skills.selection.repo.title')}</span>
                    </div>
                    <div className="hc-section-block__body">
                    <SkillSelectionPanel
                      scope="repo"
                      skills={skillsCatalog}
                      selection={skillSelection}
                      loading={skillSelectionLoading || skillsCatalogLoading}
                      saving={skillSelectionSaving}
                      disabled={repoReadOnly}
                      onRefresh={() => { void refreshSkillSelection(); void refreshSkillsCatalog(); }}
                      onChange={saveSkillSelection}
                    />
                    </div>
                  </div>
                )}

                {/* ---------- WEBHOOKS TAB — modern section blocks. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'webhooks' && (
                  <div className="hc-section-stack">
                    <div className="hc-section-block">
                      <div className="hc-section-block__header">
                        <span className="hc-section-block__title">{t('repos.detail.webhookTitle')}</span>
                        <div className="hc-section-block__extra">
                          <Button type="link" size="small" onClick={() => setWebhookIntroOpen(true)}>{t('repos.webhookIntro.open')}</Button>
                        </div>
                      </div>
                      <div className="hc-section-block__body">
                        <div className="hc-section-block__row">
                          <span className="hc-section-block__row-label">{t('repos.webhookIntro.webhookUrl')}</span>
                          <span className="hc-section-block__row-value">
                            {webhookFullUrl ? (
                              <Typography.Text code copyable style={{ wordBreak: 'break-all' }}>{webhookFullUrl}</Typography.Text>
                            ) : (
                              <Typography.Text type="secondary">-</Typography.Text>
                            )}
                          </span>
                        </div>
                        <div className="hc-section-block__row">
                          <span className="hc-section-block__row-label">{t('repos.detail.webhookSecret')}</span>
                          <span className="hc-section-block__row-value">
                            {webhookSecret ? (
                              <Space size={8}>
                                <Typography.Text code copyable={showWebhookSecretInline ? { text: webhookSecret } : false} style={{ wordBreak: 'break-all' }}>
                                  {showWebhookSecretInline ? webhookSecret : '••••••••••••••••'}
                                </Typography.Text>
                                <Button type="link" size="small" onClick={() => setShowWebhookSecretInline((v) => !v)}>
                                  {showWebhookSecretInline ? t('repos.webhookIntro.hide') : t('repos.webhookIntro.show')}
                                </Button>
                              </Space>
                            ) : (
                              <Typography.Text type="secondary">-</Typography.Text>
                            )}
                          </span>
                        </div>
                        <div className="hc-section-block__row">
                          <span className="hc-section-block__row-label">{t('repos.webhookIntro.verified')}</span>
                          <span className="hc-section-block__row-value">
                            {webhookVerified ? <Tag color="green">{t('repos.webhookIntro.verifiedYes')}</Tag> : <Tag color="gold">{t('repos.webhookIntro.verifiedNo')}</Tag>}
                          </span>
                        </div>
                        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>{t('repos.detail.webhookTip')}</Typography.Paragraph>
                      </div>
                    </div>
                    <RepoWebhookActivityCard
                      deliveries={webhookDeliveries}
                      loading={webhookDeliveriesLoading}
                      loadFailed={webhookDeliveriesFailed}
                      onRefresh={refreshWebhookDeliveries}
                    />
                    <div className="hc-section-block">
                      <div className="hc-section-block__header">
                        <span className="hc-section-block__title">{t('repos.webhookDeliveries.title')}</span>
                      </div>
                      <div className="hc-section-block__body">
                        <RepoWebhookDeliveriesPanel
                          repoId={repo.id}
                          deliveries={webhookDeliveries}
                          loading={webhookDeliveriesLoading}
                          loadFailed={webhookDeliveriesFailed}
                          onRefresh={refreshWebhookDeliveries}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------- MEMBERS TAB — modern section blocks. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 ---------- */}
                {activeTab === 'members' && (
                  canManageMembers ? (
                    <div className="hc-section-stack">
                      <div className="hc-section-block">
                        <div className="hc-section-block__header">
                          <span className="hc-section-block__title">{t('repos.members.title')}</span>
                          <div className="hc-section-block__extra">
                            <Button size="small" icon={<ReloadOutlined />} onClick={() => void refreshMembers()} disabled={membersLoading}>{t('common.refresh')}</Button>
                          </div>
                        </div>
                        <div className="hc-section-block__body">
                        <ScrollableTable<RepoMember>
                          rowKey="id"
                          dataSource={members}
                          loading={membersLoading}
                          pagination={{ pageSize: 16, showSizeChanger: false, hideOnSinglePage: true }}
                          locale={{ emptyText: t('repos.members.empty') }}
                          columns={[
                            {
                              title: t('repos.members.column.user'), key: 'user',
                              render: (_: any, member: RepoMember) => (
                                <Space direction="vertical" size={0} style={{ width: '100%' }}>
                                  <Typography.Text strong>{member.displayName || member.username}</Typography.Text>
                                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{member.username}</Typography.Text>
                                </Space>
                              )
                            },
                            { title: t('repos.members.column.email'), dataIndex: 'email', render: (value: string) => <Typography.Text type="secondary">{value || '-'}</Typography.Text> },
                            {
                              title: t('repos.members.column.role'), key: 'role',
                              render: (_: any, member: RepoMember) => {
                                const isOwner = member.role === 'owner';
                                const roleDisabled = repoReadOnly || memberUpdatingId === member.userId || (isOwner && !canDeleteRepo);
                                return <Select value={member.role} options={roleOptions} size="small" loading={memberUpdatingId === member.userId} disabled={roleDisabled} onChange={(value) => void handleUpdateMemberRole(member, value as RepoRole)} />;
                              }
                            },
                            {
                              title: t('common.actions'), key: 'actions',
                              render: (_: any, member: RepoMember) => {
                                const isOwner = member.role === 'owner';
                                const isSelf = member.userId === currentUserId;
                                const removeDisabled = repoReadOnly || memberRemovingId === member.userId || isSelf || (isOwner && !canDeleteRepo);
                                return (
                                  <Popconfirm title={t('repos.members.removeConfirmTitle')} description={t('repos.members.removeConfirmDesc')} okText={t('common.delete')} cancelText={t('common.cancel')} onConfirm={() => void handleRemoveMember(member)} disabled={removeDisabled}>
                                    <Button size="small" danger disabled={removeDisabled} loading={memberRemovingId === member.userId}>{t('common.delete')}</Button>
                                  </Popconfirm>
                                );
                              }
                            }
                          ]}
                        />
                        </div>
                      </div>
                      <div className="hc-section-block">
                        <div className="hc-section-block__header">
                          <span className="hc-section-block__title">{t('repos.invites.title')}</span>
                          <div className="hc-section-block__extra">
                            <Button size="small" icon={<ReloadOutlined />} onClick={() => void refreshInvites()} disabled={invitesLoading}>{t('common.refresh')}</Button>
                          </div>
                        </div>
                        <div className="hc-section-block__body">
                        <Form form={inviteForm} layout="vertical" requiredMark={false} initialValues={{ role: 'member' as RepoRole }} onFinish={() => void handleInviteSubmit()} disabled={repoReadOnly || inviteSubmitting}>
                          <Row gutter={12}>
                            <Col xs={24} md={16}>
                              <Form.Item name="email" label={t('repos.invites.email')} rules={[{ required: true, message: t('repos.invites.validation.emailRequired') }, { type: 'email', message: t('repos.invites.validation.emailInvalid') }]}>
                                <Input placeholder={t('repos.invites.emailPlaceholder')} />
                              </Form.Item>
                            </Col>
                            <Col xs={24} md={8}>
                              <Form.Item name="role" label={t('repos.invites.role')} rules={[{ required: true, message: t('repos.invites.validation.roleRequired') }]}>
                                <Select options={roleOptions} />
                              </Form.Item>
                            </Col>
                          </Row>
                          <Button type="primary" loading={inviteSubmitting} onClick={() => inviteForm.submit()}>{t('repos.invites.send')}</Button>
                        </Form>
                        <Divider style={{ margin: '16px 0' }} />
                        <ScrollableTable<RepoInvite>
                          rowKey="id"
                          dataSource={invites}
                          loading={invitesLoading}
                          pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }}
                          locale={{ emptyText: t('repos.invites.empty') }}
                          columns={[
                            { title: t('repos.invites.column.email'), dataIndex: 'email', render: (value: string) => <Typography.Text>{value}</Typography.Text> },
                            { title: t('repos.invites.column.role'), dataIndex: 'role', render: (value: RepoRole) => <Tag color="blue">{t(`repos.members.role.${value}` as const)}</Tag> },
                            { title: t('repos.invites.column.status'), key: 'status', render: (_: any, invite: RepoInvite) => { const status = resolveInviteStatus(invite); return <Tag color={status.color}>{t(`repos.invites.status.${status.key}`)}</Tag>; } },
                            { title: t('repos.invites.column.expiresAt'), dataIndex: 'expiresAt', render: (value: string) => <Typography.Text type="secondary">{formatTime(value)}</Typography.Text> },
                            {
                              title: t('common.actions'), key: 'actions',
                              render: (_: any, invite: RepoInvite) => {
                                const status = resolveInviteStatus(invite);
                                const revokeDisabled = repoReadOnly || status.key !== 'pending';
                                return (
                                  <Popconfirm title={t('repos.invites.revokeConfirmTitle')} description={t('repos.invites.revokeConfirmDesc')} okText={t('common.delete')} cancelText={t('common.cancel')} onConfirm={() => void handleRevokeInvite(invite)} disabled={revokeDisabled}>
                                    <Button size="small" danger disabled={revokeDisabled} loading={inviteRevokingId === invite.id}>{t('repos.invites.revoke')}</Button>
                                  </Popconfirm>
                                );
                              }
                            }
                          ]}
                        />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="hc-empty"><Empty description={t('repos.members.empty')} /></div>
                  )
                )}

                {/* ---------- TASK-GROUP TOKENS TAB ---------- */}
                {activeTab === 'taskGroupTokens' && (
                  <div className="hc-section-stack">
                    {/* Render the task-group API token list as its own tab. docs/en/developer/plans/taskgroup-token-sidebar-20260302/task_plan.md taskgroup-token-sidebar-20260302 */}
                    <div className="hc-section-block">
                      <div className="hc-section-block__header">
                        <span className="hc-section-block__title"><ApiOutlined />{t('repos.detail.autoTokens.title')}</span>
                        <div className="hc-section-block__extra">
                          <Button size="small" icon={<ReloadOutlined />} onClick={() => void refreshRepoTaskGroupTokens()} disabled={repoTaskGroupTokensLoading}>{t('common.refresh')}</Button>
                        </div>
                      </div>
                      <div className="hc-section-block__body">
                        <Typography.Text type="secondary">{t('repos.detail.autoTokens.tip')}</Typography.Text>
                        {(() => {
                          const total = repoTaskGroupTokens.length;
                          if (!total) return <div style={{ marginTop: 8 }}><Typography.Text type="secondary">{t('repos.detail.autoTokens.empty')}</Typography.Text></div>;
                          const start = (repoTaskGroupTokensPage - 1) * TASK_GROUP_TOKEN_PAGE_SIZE;
                          const paged = repoTaskGroupTokens.slice(start, start + TASK_GROUP_TOKEN_PAGE_SIZE);
                          return (
                            <>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                {paged.map((tokenItem) => {
                                  const now = Date.now();
                                  const expiresAt = tokenItem.expiresAt ? new Date(tokenItem.expiresAt).getTime() : null;
                                  const isExpired = Boolean(expiresAt && expiresAt <= now);
                                  const isRevoked = Boolean(tokenItem.revokedAt);
                                  const statusKey = isRevoked ? 'revoked' : isExpired ? 'expired' : 'active';
                                  const statusColor = isRevoked ? 'red' : isExpired ? 'orange' : 'green';
                                  return (
                                    <div key={tokenItem.id} className="hc-section-block__item">
                                      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                                        <Space size={8} wrap>
                                          <Typography.Text strong>{tokenItem.name}</Typography.Text>
                                          <Tag color={statusColor}>{t(`panel.apiTokens.status.${statusKey}`)}</Tag>
                                        </Space>
                                        <Typography.Text type="secondary">{t('panel.apiTokens.field.expiresAt')}: {formatTokenTime(tokenItem.expiresAt ?? null)}</Typography.Text>
                                      </Space>
                                      <Space size={16} wrap style={{ marginTop: 8, justifyContent: 'space-between', width: '100%' }}>
                                        <Space size={12} wrap>
                                          <Typography.Text type="secondary">{t('panel.apiTokens.field.createdAt')}: {formatTokenTime(tokenItem.createdAt)}</Typography.Text>
                                          <Typography.Text type="secondary">{t('panel.apiTokens.field.lastUsed')}: {formatTokenTime(tokenItem.lastUsedAt ?? null)}</Typography.Text>
                                        </Space>
                                        <Popconfirm title={t('panel.apiTokens.revokeTitle')} description={t('panel.apiTokens.revokeDesc')} okText={t('panel.apiTokens.revokeOk')} cancelText={t('common.cancel')} onConfirm={() => void revokeRepoTaskGroupToken(tokenItem)}>
                                          <Button size="small" danger loading={repoTaskGroupTokenRevokingId === tokenItem.id} disabled={isRevoked || repoReadOnly}>{t('panel.apiTokens.revoke')}</Button>
                                        </Popconfirm>
                                      </Space>
                                    </div>
                                  );
                                })}
                              </div>
                              {total > TASK_GROUP_TOKEN_PAGE_SIZE ? (
                                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                                  <Pagination size="small" current={repoTaskGroupTokensPage} pageSize={TASK_GROUP_TOKEN_PAGE_SIZE} total={total} showSizeChanger={false} onChange={(page) => setRepoTaskGroupTokensPage(page)} />
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {/* ---------- SETTINGS TAB ---------- */}
                {activeTab === 'settings' && (
                  <div className="hc-section-stack">
                    {/* Danger zone — uses danger variant. docs/en/developer/plans/repo-detail-modernize-20260301/task_plan.md repo-detail-modernize-20260301 */}
                    {canDeleteRepo ? (
                      <div className="hc-section-block hc-section-block--danger">
                        <div className="hc-section-block__header">
                          <span className="hc-section-block__title">{t('repos.danger.title')}</span>
                        </div>
                        <div className="hc-section-block__body">
                          <Typography.Text type="secondary">{t('repos.danger.desc')}</Typography.Text>
                          <div style={{ marginTop: 12 }}>
                            <Popconfirm title={t('repos.danger.confirmTitle')} description={t('repos.danger.confirmDesc')} okText={t('common.delete')} cancelText={t('common.cancel')} onConfirm={() => void handleDeleteRepo()}>
                              <Button danger loading={repoDeleting} disabled={repoDeleting}>{t('repos.danger.delete')}</Button>
                            </Popconfirm>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )
          ) : loading ? (
            <RepoDetailSkeleton testId="hc-repo-detail-skeleton" ariaLabel={t('common.loading')} />
          ) : (
            <div className="hc-empty"><Empty description={t('repos.detail.notFound')} /></div>
          )}
        </div>
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
        open={repoProviderProfileModalOpen}
        title={repoProviderProfileEditing ? t('panel.credentials.profile.editTitle') : t('panel.credentials.profile.addTitle')}
        onCancel={() => {
          setRepoProviderProfileModalOpen(false);
          setRepoProviderProfileEditing(null);
        }}
        confirmLoading={repoProviderProfileSubmitting}
        onOk={() => void submitRepoProviderProfile()}
        variant="compact"
        modalWidth={520}
        className="hc-dialog--compact" /* UX (2026-01-15): tighter padding + unified surface in dark mode for profile editors. */
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
	          <Typography.Text type="secondary">{t('panel.credentials.profile.providerHint', { provider: repo ? providerLabel(repo.provider) : '-' })}</Typography.Text>
	          {/* UX (2026-01-15): Use default control sizing inside modals (avoid overly compact inputs). */}
	          <Form form={repoProviderProfileForm} layout="vertical" requiredMark={false} size="middle">
	            <Form.Item label={t('panel.credentials.profile.name')} name="remark" rules={[{ required: true, message: t('panel.validation.required') }]}>
	              <Input placeholder={t('panel.credentials.profile.namePlaceholder')} />
	            </Form.Item>
	            <Form.Item label={t('panel.credentials.profile.cloneUsername')} name="cloneUsername">
	              <Input placeholder={t('panel.credentials.profile.cloneUsernamePlaceholder')} />
	            </Form.Item>

            <Form.Item label={t('panel.credentials.profile.token')}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                {repoProviderProfileEditing?.hasToken ? (
                  <Radio.Group value={repoProviderTokenMode} onChange={(e) => setRepoProviderTokenMode(e.target.value)}>
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
                      required: repoProviderTokenMode === 'set',
                      whitespace: true,
                      message: t('panel.validation.required')
                    }
                  ]}
                >
                  <Input.Password
                    placeholder={t('panel.credentials.secretInputPlaceholder')}
                    disabled={repoProviderTokenMode !== 'set'}
                    autoComplete="new-password"
                  />
                </Form.Item>
                {/* Token hint: show provider-specific PAT guidance near the input. (Change record: 2026-01-15) */}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {repo?.provider === 'github' ? t('panel.credentials.profile.tokenHelp.github') : t('panel.credentials.profile.tokenHelp.gitlab')}
                </Typography.Text>
              </Space>
            </Form.Item>

            <Form.Item label={t('panel.credentials.profile.setDefault')}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Switch
                  checked={repoProviderSetDefault}
                  onChange={(checked) => setRepoProviderSetDefault(checked)}
                  disabled={credentialsSaving || repoReadOnly}
                />
                {/* Let users toggle the default profile directly inside the manage modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('panel.credentials.profile.setDefaultDesc')}
                </Typography.Text>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </ResponsiveDialog>

      <ResponsiveDialog
        open={modelProfileModalOpen}
        title={modelProfileEditing ? t('panel.credentials.profile.editTitle') : t('panel.credentials.profile.addTitle')}
        onCancel={() => {
          setModelProfileModalOpen(false);
          setModelProfileEditing(null);
        }}
        confirmLoading={modelProfileSubmitting}
        onOk={() => void submitModelProfile()}
        variant="compact"
        modalWidth={520}
        className="hc-dialog--compact" /* UX (2026-01-15): tighter padding + unified surface in dark mode for profile editors. */
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
	          {/* Allow choosing model provider when creating profiles from the unified list. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
	          {/* UX (2026-01-15): Use default control sizing inside modals (avoid overly compact inputs). */}
	          <Form form={modelProfileForm} layout="vertical" requiredMark={false} size="middle">
              <Form.Item label={t('panel.credentials.profile.providerLabel')}>
                <Select
                  value={modelProfileProvider}
                  placeholder={t('panel.credentials.profile.providerPlaceholder')}
                  options={[
                    { value: 'codex', label: t('panel.credentials.codexTitle') },
                    { value: 'claude_code', label: t('panel.credentials.claudeCodeTitle') },
                    { value: 'gemini_cli', label: t('panel.credentials.geminiCliTitle') }
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
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
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

            {/* Disable model catalog actions for read-only repos. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
            <Form.Item label={t('modelCatalog.title')}>
              <ModelProviderModelsButton
                disabled={modelProfileSubmitting || repoReadOnly}
                buttonProps={{ size: 'small' }}
                loadModels={async ({ forceRefresh }) => {
                  // Fetch models using either repo-stored credentials (keep mode) or the in-form apiKey (set mode). b8fucnmey62u0muyn7i0
                  const apiBaseUrl = String(modelProfileForm.getFieldValue('apiBaseUrl') ?? '').trim();
                  const apiKey =
                    modelProfileApiKeyMode === 'set' ? String(modelProfileForm.getFieldValue('apiKey') ?? '').trim() : '';
                  const profileId = modelProfileApiKeyMode === 'keep' ? modelProfileEditing?.id : undefined;

                  return listRepoModelProviderModels(repoId, {
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

            {/* Disable default profile toggles for read-only repos. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
            <Form.Item label={t('panel.credentials.profile.setDefault')}>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Switch
                  checked={modelProfileSetDefault}
                  onChange={(checked) => setModelProfileSetDefault(checked)}
                  disabled={modelProfileSubmitting || repoReadOnly}
                />
                {/* Let users toggle the default profile directly inside the manage modal. docs/en/developer/plans/4j0wbhcp2cpoyi8oefex/task_plan.md 4j0wbhcp2cpoyi8oefex */}
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {t('panel.credentials.profile.setDefaultDesc')}
                </Typography.Text>
              </Space>
            </Form.Item>
          </Form>
        </Space>
      </ResponsiveDialog>

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
        cancelText={repoReadOnly ? t('common.close') : t('common.cancel')}
        confirmLoading={robotSubmitting}
        onOk={repoReadOnly ? undefined : () => void robotForm.submit()} // Prevent robot mutations when repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
        drawerWidth="min(980px, 92vw)"
        >
          {/* Disable the robot editor form when repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
          <Form<RobotFormValues>
            form={robotForm}
            layout="vertical"
            requiredMark={false}
            disabled={robotSubmitting || repoReadOnly}
            onFinish={(values) => void handleSubmitRobot(values)}
            initialValues={buildRobotInitialValues(editingRobot)}
          >
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
                    disabled={watchedRepoCredentialSource === 'robot'}
                    loading={userModelCredentialsLoading && watchedRepoCredentialSource === 'user'}
                    placeholder={t('repos.robotForm.repoCredential.profilePlaceholder')}
                    options={(() => {
                      const source = watchedRepoCredentialSource === 'repo' ? 'repo' : watchedRepoCredentialSource === 'robot' ? 'robot' : 'user';
                      if (source === 'robot') return [];

                      const providerCredentials =
                        source === 'user'
                          ? repo?.provider === 'github'
                            ? userModelCredentials?.github
                            : userModelCredentials?.gitlab
                          : repoScopedCredentials?.repoProvider;
                      const profiles = providerCredentials?.profiles ?? [];
                      return profiles.map((p) => ({ value: p.id, label: p.remark || p.id, disabled: !p.hasToken }));
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
                  <>
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

                    <Form.Item label={t('repos.robotForm.repoCredential.remark')} name="repoCredentialRemark">
                      <Input placeholder={t('repos.robotForm.repoCredential.remarkPlaceholder')} />
                    </Form.Item>
                  </>
                ) : normalizedSource === 'repo' ? (
                  <Alert
                    type={repoScopedCredentials?.repoProvider?.profiles?.some((p) => p.hasToken) ? 'info' : 'warning'}
                    showIcon
                    message={
                      repoScopedCredentials?.repoProvider?.profiles?.some((p) => p.hasToken)
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

            {/* Provide explicit workflow selection and a validation action for repo pull behavior. docs/en/developer/plans/robotpullmode20260124/task_plan.md robotpullmode20260124 */}
            <Form.Item label={t('repos.robotForm.workflowMode')}>
              <Space wrap size={12}>
                <Form.Item name="repoWorkflowMode" noStyle>
                  <Radio.Group
                    options={[
                      { value: 'auto', label: t('repos.robotForm.workflowMode.auto') },
                      { value: 'direct', label: t('repos.robotForm.workflowMode.direct') },
                      { value: 'fork', label: t('repos.robotForm.workflowMode.fork') }
                    ]}
                  />
                </Form.Item>
                <Button
                  onClick={() => void handleTestRobotWorkflow()}
                  loading={robotWorkflowTestingId === editingRobot?.id}
                >
                  {t('repos.robotForm.workflowMode.check')}
                </Button>
              </Space>
            </Form.Item>

            {/* Provide robot-level scheduling controls for time-window execution. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126 */}
            <Form.Item label={t('repos.robotForm.timeWindow')} name="timeWindow">
              {/* Disable scheduling edits when repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
              <TimeWindowPicker disabled={repoReadOnly} size="middle" />
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

                const repoProviderCredentials = (repoScopedCredentials as any)?.modelProvider?.[provider] as any;
                const userProviderCredentials = (userModelCredentials as any)?.[provider] as any;
                const repoHasApiKey = Array.isArray(repoProviderCredentials?.profiles)
                  ? repoProviderCredentials.profiles.some((p: any) => p && p.hasApiKey)
                  : false;
                const userHasApiKey = Array.isArray(userProviderCredentials?.profiles)
                  ? userProviderCredentials.profiles.some((p: any) => p && p.hasApiKey)
                  : false;

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
                                      credentialProfileId: null,
                                      model: 'claude-sonnet-4-5-20250929',
                                      sandbox: 'read-only',
                                      sandbox_workspace_write: { network_access: false }
                                    }
                                  : nextProvider === 'gemini_cli'
                                    ? {
                                        credentialSource: 'user',
                                        credentialProfileId: null,
                                        model: 'gemini-2.5-pro',
                                        sandbox: 'read-only',
                                        sandbox_workspace_write: { network_access: false }
                                      }
                                  : {
                                      credentialSource: 'user',
                                      credentialProfileId: null,
                                      model: 'gpt-5.2',
                                      sandbox: 'read-only',
                                      // Codex defaults omit network access since it is always enabled now. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127
                                      model_reasoning_effort: 'medium'
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

                    {source !== 'robot' ? (
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label={t('repos.robotForm.modelCredential.profile')}
                            name={['modelProviderConfig', 'credentialProfileId']}
                            rules={[
                              {
                                required: source !== 'robot',
                                message: t('repos.robotForm.modelCredential.profileRequired')
                              }
                            ]}
                          >
                            <Select
                              loading={userModelCredentialsLoading && source === 'user'}
                              placeholder={t('repos.robotForm.modelCredential.profilePlaceholder')}
                              options={(() => {
                                const providerCredentials = source === 'user' ? userProviderCredentials : repoProviderCredentials;
                                const profiles = Array.isArray(providerCredentials?.profiles) ? providerCredentials.profiles : [];
                                return profiles.map((p: any) => ({ value: p.id, label: p.remark || p.id, disabled: !p.hasApiKey }));
                              })()}
                            />
                          </Form.Item>
                        </Col>
                      </Row>
                    ) : null}

                    {source === 'robot' ? (
                      <>
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
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
                                        if (!next) {
                                          robotForm.setFieldsValue({
                                            modelProviderConfig: {
                                              ...robotForm.getFieldValue('modelProviderConfig'),
                                              credential: { ...robotForm.getFieldValue(['modelProviderConfig', 'credential']), apiKey: '' }
                                            }
                                          } as any);
                                        }
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
                          <Col xs={24} md={12}>
                            <Form.Item label={t('repos.robotForm.modelCredential.remark')} name={['modelProviderConfig', 'credential', 'remark']}>
                              <Input placeholder={t('repos.robotForm.modelCredential.remarkPlaceholder')} />
                            </Form.Item>
                          </Col>
                        </Row>

                        {/* UX: keep proxy/base URL below the API key input (especially for Claude/Gemini). */}
                        <Form.Item
                          label={t('repos.robotForm.modelCredential.apiBaseUrl')}
                          name={['modelProviderConfig', 'credential', 'apiBaseUrl']}
                        >
                          <Input placeholder={t('repos.robotForm.modelCredential.apiBaseUrlPlaceholder')} />
                        </Form.Item>
                      </>
                    ) : source === 'repo' ? (
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Alert
                          type={repoHasApiKey ? 'info' : 'warning'}
                          showIcon
                          message={repoHasApiKey ? t(repoConfiguredKey) : t(repoNotConfiguredKey)}
                          style={{ marginBottom: 12 }}
                        />
                        {/* Surface repo-scoped model credential setup from the robot form to avoid onboarding dead-ends. docs/en/developer/plans/repo-guide-visibility-20260227/task_plan.md repo-guide-visibility-20260227 */}
                        {!repoHasApiKey ? (
                          <Button
                            size="small"
                            disabled={credentialsSaving || repoReadOnly}
                            onClick={() => startEditModelProfile(provider, null)}
                          >
                            {t('repos.robotForm.modelCredential.addRepoCredential')}
                          </Button>
                        ) : null}
                      </Space>
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
                          {/* Use the bound picker field so model clicks update the form value. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
                          {/* Disable model picker when repo is read-only. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
                          <ModelPickerField
                            pickerDisabled={repoReadOnly || (source === 'robot' && apiKeyDisabled)}
                            loadModels={async ({ forceRefresh }) => {
                              // Load models based on the selected credential source so robot config avoids hardcoded model ids. b8fucnmey62u0muyn7i0
                              const credentialSource = normalizeCredentialSource(watchedModelCredentialSource);
                              const credentialProfileId = String(watchedModelCredentialProfileId ?? '').trim();

                              if (credentialSource === 'user') {
                                return listMyModelProviderModels({
                                  provider,
                                  profileId: credentialProfileId || undefined,
                                  forceRefresh
                                });
                              }

                              if (credentialSource === 'repo') {
                                return listRepoModelProviderModels(repoId, {
                                  provider,
                                  profileId: credentialProfileId || undefined,
                                  forceRefresh
                                });
                              }

                              const apiKey = String(robotForm.getFieldValue(['modelProviderConfig', 'credential', 'apiKey']) ?? '').trim();
                              const apiBaseUrl = String(robotForm.getFieldValue(['modelProviderConfig', 'credential', 'apiBaseUrl']) ?? '').trim();

                              return listRepoModelProviderModels(repoId, {
                                provider,
                                credential: { apiKey: apiKey || null, apiBaseUrl: apiBaseUrl || null },
                                forceRefresh
                              });
                            }}
                          />
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
                      {/* Hide network access toggle for Codex because it is always enabled. docs/en/developer/plans/codexnetaccess20260127/task_plan.md codexnetaccess20260127 */}
                      {!isCodex ? (
                        <Col xs={24} md={24}>
                          <Form.Item label={t('repos.robotForm.networkAccess')} name={['modelProviderConfig', 'sandbox_workspace_write', 'network_access']} valuePropName="checked">
                            <Switch disabled={networkAccessDisabled} />
                          </Form.Item>
                        </Col>
                      ) : null}
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

          <div style={{ height: 12 }} />

          {/* Add robot dependency override controls for per-robot install behavior. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
          <Card size="small" title={t('repos.robotForm.section.dependency')} className="hc-inner-card" styles={{ body: { padding: 12 } }}>
            <Form.Item label={t('repos.robotForm.dependency.override')} name="dependencyOverride" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item shouldUpdate noStyle>
              {({ getFieldValue }) => {
                const overrideEnabled = Boolean(getFieldValue('dependencyOverride'));
                return (
                  <>
                    <Alert
                      type="info"
                      showIcon
                      message={overrideEnabled ? t('repos.robotForm.dependency.overrideEnabledTip') : t('repos.robotForm.dependency.overrideDisabledTip')}
                      style={{ marginBottom: 12 }}
                    />

                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item label={t('repos.robotForm.dependency.enabled')} name={['dependencyConfig', 'enabled']} valuePropName="checked">
                          <Switch disabled={!overrideEnabled} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item label={t('repos.robotForm.dependency.failureMode')} name={['dependencyConfig', 'failureMode']}>
                          <Select
                            disabled={!overrideEnabled}
                            options={[
                              { value: 'inherit', label: t('repos.robotForm.dependency.failureMode.inherit') },
                              { value: 'soft', label: t('repos.robotForm.dependency.failureMode.soft') },
                              { value: 'hard', label: t('repos.robotForm.dependency.failureMode.hard') }
                            ]}
                          />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Form.Item
                      label={t('repos.robotForm.dependency.allowCustomInstall')}
                      name={['dependencyConfig', 'allowCustomInstall']}
                      valuePropName="checked"
                    >
                      <Switch disabled={!overrideEnabled} />
                    </Form.Item>
                  </>
                );
              }}
            </Form.Item>
          </Card>
        </Form>
      </ResponsiveDialog>
    </>
  );
};

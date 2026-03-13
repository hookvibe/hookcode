/**
 * Frontend Chat hash router helpers.
 *
 * Business context:
 * - Module: Frontend Chat / Routing.
 * - Purpose: keep a dependency-free router (hash-based) so static hosting needs no rewrite rules.
 *
 * Change record:
 * - 2026-01-11: Introduced routes for Home/Tasks/Task detail/Task group chat while keeping `#/chat` as an alias.
 */

export type RoutePage =
  | 'home'
  | 'tasks'
  | 'task'
  | 'taskGroup'
  | 'taskGroups'
  | 'repos'
  | 'repo'
  | 'archive'
  | 'login'
  | 'register'
  | 'verifyEmail'
  | 'acceptInvite'
  | 'skills'
  | 'settings'; // Add settings page route for standalone user settings panel. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301

// Preserve both preview env and task-group token repo tabs when reconciling main/dev routing. docs/en/developer/plans/sync-main-dev-20260303/task_plan.md sync-main-dev-20260303
export type RepoTab =
  | 'overview'
  | 'basic'
  | 'branches'
  | 'credentials'
  | 'env'
  | 'robots'
  | 'automation'
  | 'skills'
  | 'webhooks'
  | 'members'
  | 'taskGroupTokens'
  | 'settings';

export const REPO_TABS: RepoTab[] = [
  'overview',
  'basic',
  'branches',
  'credentials',
  'env',
  'robots',
  'automation',
  'skills',
  'webhooks',
  'members',
  'taskGroupTokens',
  'settings'
];

// Define the available sub-tabs for the archive page sidebar navigation. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
export type ArchiveTab = 'repos' | 'tasks';

export const ARCHIVE_TABS: ArchiveTab[] = ['repos', 'tasks'];

// Define the available sub-tabs for the skills page sidebar navigation. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
export type SkillsTab = 'overview' | 'built-in' | 'extra';

export const SKILLS_TABS: SkillsTab[] = ['overview', 'built-in', 'extra'];

// Define the available sub-tabs for the user settings page sidebar navigation. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
// Add an admin preview tab for global preview runtime/port management. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303
export type SettingsTab = 'account' | 'credentials' | 'tools' | 'environment' | 'approvals' | 'settings' | 'logs' | 'notifications' | 'preview' | 'webhooks' | 'workers'; // Add worker registry routing to the settings page for executor management. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307

// Add the admin webhook replay/debug center as a first-class settings route. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313
export const SETTINGS_TABS: SettingsTab[] = ['account', 'credentials', 'tools', 'environment', 'approvals', 'settings', 'logs', 'notifications', 'preview', 'webhooks', 'workers'];

export interface RouteState {
  page: RoutePage;
  taskId?: string;
  taskGroupId?: string;
  repoId?: string;
  // Track the active sub-tab within repo detail sidebar navigation. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  repoTab?: RepoTab;
  // Track the active sub-tab within user settings page navigation. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
  settingsTab?: SettingsTab;
  tasksStatus?: string;
  tasksRepoId?: string;
  taskGroupsRepoId?: string; // Support repo-scoped task-group lists via hash query. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  // Track the active sub-tab within archive page sidebar navigation. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  archiveTab?: ArchiveTab;
  // Track the active sub-tab within skills page sidebar navigation. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
  skillsTab?: SkillsTab;
  // Store auth/invite tokens parsed from hash query. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
  verifyEmailEmail?: string;
  verifyEmailToken?: string;
  inviteEmail?: string;
  inviteToken?: string;
}

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseQuery = (queryRaw: string | undefined): Record<string, string> => {
  const query = String(queryRaw ?? '').trim().replace(/^\?/, '');
  if (!query) return {};
  const out: Record<string, string> = {};
  for (const part of query.split('&')) {
    if (!part) continue;
    const [kRaw, vRaw] = part.split('=');
    const key = safeDecode(String(kRaw ?? '').trim());
    if (!key) continue;
    out[key] = safeDecode(String(vRaw ?? '').trim());
  }
  return out;
};

export const parseRoute = (hash: string): RouteState => {
  const raw = String(hash ?? '').replace(/^#/, '');
  const [pathRaw, queryRaw] = raw.split('?');
  const query = parseQuery(queryRaw);

  const parts = String(pathRaw ?? '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);

  // Business intent: make the chat UI the default home page.
  if (parts.length === 0) return { page: 'home' };
  if (parts.length === 1 && parts[0] === 'chat') return { page: 'home' };

  if (parts[0] === 'tasks') {
    if (parts.length === 2 && parts[1]) return { page: 'task', taskId: parts[1] };
    // Allow repo-scoped task lists via hash query (e.g. `#/tasks?status=processing&repoId=...`). aw85xyfsp5zfg6ihq3jr
    const state: RouteState = { page: 'tasks', tasksStatus: query.status };
    if (query.repoId) state.tasksRepoId = query.repoId;
    return state;
  }

  if (parts[0] === 'task-groups') {
    if (parts.length === 2 && parts[1]) return { page: 'taskGroup', taskGroupId: parts[1] };
    // Route the task group index to the card list view. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw
    const state: RouteState = { page: 'taskGroups' };
    if (query.repoId) state.taskGroupsRepoId = query.repoId;
    return state;
  }

  if (parts[0] === 'repos') {
    if (parts.length >= 2 && parts[1]) {
      // Parse optional sub-tab from the third path segment (e.g. #/repos/:id/robots). docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
      const tab = parts[2] as RepoTab | undefined;
      const validTab = tab && REPO_TABS.includes(tab) ? tab : undefined;
      return { page: 'repo', repoId: parts[1], repoTab: validTab };
    }
    return { page: 'repos' };
  }

  if (parts[0] === 'archive') {
    // Parse optional sub-tab from the second path segment (e.g. #/archive/tasks). docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
    const tab = parts[1] as ArchiveTab | undefined;
    const validTab = tab && ARCHIVE_TABS.includes(tab) ? tab : undefined;
    // Backward compat: also check query param for old-style hash (#/archive?tab=repos). docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
    const fallbackTab = query.tab && ARCHIVE_TABS.includes(query.tab as ArchiveTab) ? (query.tab as ArchiveTab) : undefined;
    return { page: 'archive', archiveTab: validTab || fallbackTab };
  }

  if (parts[0] === 'skills') {
    // Parse optional sub-tab from the second path segment (e.g. #/skills/built-in). docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
    const tab = parts[1] as SkillsTab | undefined;
    const validTab = tab && SKILLS_TABS.includes(tab) ? tab : undefined;
    return { page: 'skills', skillsTab: validTab };
  }

  if (parts[0] === 'settings') {
    // Parse optional sub-tab from the second path segment (e.g. #/settings/credentials). docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
    const tab = parts[1] as SettingsTab | undefined;
    const validTab = tab && SETTINGS_TABS.includes(tab) ? tab : undefined;
    return { page: 'settings', settingsTab: validTab };
  }

  if (parts[0] === 'login') return { page: 'login' };
  if (parts[0] === 'register') return { page: 'register' };
  if (parts[0] === 'verify-email') {
    // Parse email verification tokens from the hash query. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    return { page: 'verifyEmail', verifyEmailEmail: query.email, verifyEmailToken: query.token };
  }
  if (parts[0] === 'accept-invite') {
    // Parse repo invite tokens from the hash query. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
    return { page: 'acceptInvite', inviteEmail: query.email, inviteToken: query.token };
  }

  // Fallback: keep unknown hashes safe by sending users to Home.
  return { page: 'home' };
};

export const buildHomeHash = (): string => '#/';
// Provide hash builders for auth + invite routes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226
export const buildLoginHash = (): string => '#/login';
export const buildRegisterHash = (): string => '#/register';
export const buildVerifyEmailHash = (params?: { email?: string; token?: string }): string => {
  const email = String(params?.email ?? '').trim();
  const token = String(params?.token ?? '').trim();
  const query: string[] = [];
  if (email) query.push(`email=${encodeURIComponent(email)}`);
  if (token) query.push(`token=${encodeURIComponent(token)}`);
  return query.length ? `#/verify-email?${query.join('&')}` : '#/verify-email';
};
export const buildAcceptInviteHash = (params?: { email?: string; token?: string }): string => {
  const email = String(params?.email ?? '').trim();
  const token = String(params?.token ?? '').trim();
  const query: string[] = [];
  if (email) query.push(`email=${encodeURIComponent(email)}`);
  if (token) query.push(`token=${encodeURIComponent(token)}`);
  return query.length ? `#/accept-invite?${query.join('&')}` : '#/accept-invite';
};

export const buildTasksHash = (options?: { status?: string; repoId?: string }): string => {
  const status = String(options?.status ?? '').trim();
  const repoId = String(options?.repoId ?? '').trim();
  const query: string[] = [];
  if (status) query.push(`status=${encodeURIComponent(status)}`);
  if (repoId) query.push(`repoId=${encodeURIComponent(repoId)}`);
  return query.length ? `#/tasks?${query.join('&')}` : '#/tasks';
};

export const buildTaskHash = (taskId: string): string => `#/tasks/${encodeURIComponent(taskId)}`;

export const buildTaskGroupHash = (taskGroupId: string): string =>
  `#/task-groups/${encodeURIComponent(taskGroupId)}`;

export const buildTaskGroupsHash = (options?: { repoId?: string }): string => {
  // Add optional repo scoping so repo dashboards can deep-link to filtered task groups. docs/en/developer/plans/jmdhqw70p9m32onz45v5/task_plan.md jmdhqw70p9m32onz45v5
  const repoId = String(options?.repoId ?? '').trim();
  const query: string[] = [];
  if (repoId) query.push(`repoId=${encodeURIComponent(repoId)}`);
  return query.length ? `#/task-groups?${query.join('&')}` : '#/task-groups';
};

export const buildReposHash = (): string => '#/repos';

export const buildRepoHash = (repoId: string, tab?: RepoTab): string => {
  // Build a repo detail hash with optional sub-tab path. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const base = `#/repos/${encodeURIComponent(repoId)}`;
  return tab ? `${base}/${tab}` : base;
};

// Build an archive page hash with optional sub-tab path. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
export const buildArchiveHash = (tab?: ArchiveTab): string => {
  const base = '#/archive';
  return tab ? `${base}/${tab}` : base;
};

// Build a skills page hash with optional sub-tab path. docs/en/developer/plans/sidebar-pages-20260301/task_plan.md sidebar-pages-20260301
export const buildSkillsHash = (tab?: SkillsTab): string => {
  const base = '#/skills';
  return tab ? `${base}/${tab}` : base;
};

// Build a settings page hash with optional sub-tab path. docs/en/developer/plans/user-panel-page-20260301/task_plan.md user-panel-page-20260301
export const buildSettingsHash = (tab?: SettingsTab): string => {
  const base = '#/settings';
  return tab ? `${base}/${tab}` : base;
};

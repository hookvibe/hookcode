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
  | 'skills';

// Define the available sub-tabs for the repo detail page sidebar navigation. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
export type RepoTab = 'overview' | 'basic' | 'branches' | 'credentials' | 'robots' | 'automation' | 'skills' | 'webhooks' | 'members' | 'settings';

export const REPO_TABS: RepoTab[] = ['overview', 'basic', 'branches', 'credentials', 'robots', 'automation', 'skills', 'webhooks', 'members', 'settings'];

export interface RouteState {
  page: RoutePage;
  taskId?: string;
  taskGroupId?: string;
  repoId?: string;
  // Track the active sub-tab within repo detail sidebar navigation. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  repoTab?: RepoTab;
  tasksStatus?: string;
  tasksRepoId?: string;
  archiveTab?: string;
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
    return { page: 'taskGroups' };
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
    // Add an Archive route so archived repos/tasks have a dedicated console area. qnp1mtxhzikhbi0xspbc
    const state: RouteState = { page: 'archive' };
    if (query.tab) state.archiveTab = query.tab;
    return state;
  }

  if (parts[0] === 'skills') {
    // Route to the skills registry page for built-in/extra skill management. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225
    return { page: 'skills' };
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

export const buildTaskGroupsHash = (): string => '#/task-groups'; // Provide a stable list route for the taskgroup cards page. docs/en/developer/plans/f39gmn6cmthygu02clmw/task_plan.md f39gmn6cmthygu02clmw

export const buildReposHash = (): string => '#/repos';

export const buildRepoHash = (repoId: string, tab?: RepoTab): string => {
  // Build a repo detail hash with optional sub-tab path. docs/en/developer/plans/repo-detail-subnav-20260228/task_plan.md repo-detail-subnav-20260228
  const base = `#/repos/${encodeURIComponent(repoId)}`;
  return tab ? `${base}/${tab}` : base;
};

export const buildArchiveHash = (options?: { tab?: 'repos' | 'tasks' }): string => {
  const tab = String(options?.tab ?? '').trim();
  return tab ? `#/archive?tab=${encodeURIComponent(tab)}` : '#/archive';
};

export const buildSkillsHash = (): string => '#/skills'; // Add a stable route for the skills registry page. docs/en/developer/plans/skills-registry-20260225/task_plan.md skills-registry-20260225

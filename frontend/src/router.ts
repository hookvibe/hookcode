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

export type RoutePage = 'home' | 'tasks' | 'task' | 'taskGroup' | 'repos' | 'repo' | 'login';

export interface RouteState {
  page: RoutePage;
  taskId?: string;
  taskGroupId?: string;
  repoId?: string;
  tasksStatus?: string;
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
    return { page: 'tasks', tasksStatus: query.status };
  }

  if (parts[0] === 'task-groups') {
    if (parts.length === 2 && parts[1]) return { page: 'taskGroup', taskGroupId: parts[1] };
    return { page: 'home' };
  }

  if (parts[0] === 'repos') {
    if (parts.length === 2 && parts[1]) return { page: 'repo', repoId: parts[1] };
    return { page: 'repos' };
  }

  if (parts[0] === 'login') return { page: 'login' };

  // Fallback: keep unknown hashes safe by sending users to Home.
  return { page: 'home' };
};

export const buildHomeHash = (): string => '#/';

export const buildTasksHash = (options?: { status?: string }): string => {
  const status = String(options?.status ?? '').trim();
  return status ? `#/tasks?status=${encodeURIComponent(status)}` : '#/tasks';
};

export const buildTaskHash = (taskId: string): string => `#/tasks/${encodeURIComponent(taskId)}`;

export const buildTaskGroupHash = (taskGroupId: string): string =>
  `#/task-groups/${encodeURIComponent(taskGroupId)}`;

export const buildReposHash = (): string => '#/repos';

export const buildRepoHash = (repoId: string): string => `#/repos/${encodeURIComponent(repoId)}`;

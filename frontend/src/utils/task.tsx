import { Tag } from 'antd';
import type { Task, TaskStatus } from '../api';
import type { TFunction } from '../i18n';
import { formatTimeWindowLabel } from './timeWindow';

/**
 * Task UI helpers (Frontend Chat).
 *
 * Business context:
 * - Module: Frontend Chat / Tasks.
 * - Purpose: normalize task labels and common extraction logic shared by sidebar, list, and chat views.
 *
 * Change record:
 * - 2026-01-11: Added to support the first migration step (Home sidebar + task/group navigation).
 */

export const isTerminalStatus = (status: TaskStatus): boolean =>
  status === 'succeeded' || status === 'failed' || status === 'commented';

export const statusTag = (t: TFunction, status: TaskStatus) => {
  const map: Record<TaskStatus, { color: string; text: string }> = {
    queued: { color: 'blue', text: t('task.status.queued') },
    processing: { color: 'gold', text: t('task.status.processing') },
    succeeded: { color: 'green', text: t('task.status.succeeded') },
    failed: { color: 'red', text: t('task.status.failed') },
    commented: { color: 'purple', text: t('task.status.commented') }
  };
  const item = map[status];
  return <Tag color={item.color}>{item.text}</Tag>;
};

export const queuedHintText = (t: TFunction, task?: Task | null): string | null => {
  // Derive a short, i18n-friendly hint for queued tasks from backend queue diagnosis. f3a9c2d8e1b7f4a0c6d1
  if (!task || task.status !== 'queued') return null;
  const q = task.queue;
  if (!q) return t('tasks.queue.hint.unknown');

  const ahead = typeof q.ahead === 'number' && Number.isFinite(q.ahead) ? q.ahead : 0;
  const processing = typeof q.processing === 'number' && Number.isFinite(q.processing) ? q.processing : 0;

  if (q.reasonCode === 'outside_time_window') {
    const windowLabel = formatTimeWindowLabel(q.timeWindow);
    const sourceLabel = q.timeWindow ? t(`tasks.queue.timeWindow.source.${q.timeWindow.source}` as any) : t('tasks.queue.hint.unknown');
    // Highlight time-window gating so users understand queued tasks. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
    return t('tasks.queue.hint.timeWindow', { window: windowLabel || '--:--', source: sourceLabel });
  }
  if (q.reasonCode === 'queue_backlog') return t('tasks.queue.hint.backlog', { ahead, processing });
  if (q.reasonCode === 'inline_worker_disabled') return t('tasks.queue.hint.inlineWorkerDisabled');
  if (q.reasonCode === 'no_active_worker') return t('tasks.queue.hint.noActiveWorker');
  return t('tasks.queue.hint.unknown');
};

export const getTaskTitle = (task: Task): string => {
  const title = String(task.title ?? '').trim();
  if (title) return title;
  return task.id;
};

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

const shortSha = (sha: string, len = 7): string => {
  const trimmed = sha.trim();
  if (!trimmed) return '';
  return trimmed.length <= len ? trimmed : trimmed.slice(0, len);
};

const inferRepoProvider = (task: Task): string => {
  const provider = safeTrim(task.repo?.provider ?? task.repoProvider);
  if (provider) return provider;
  const payload: any = task.payload ?? {};
  if (payload?.repository) return 'github';
  if (payload?.project) return 'gitlab';
  return '';
};

export const getTaskRepoName = (task: Task): string => {
  const payload: any = task.payload ?? {};
  return (
    safeTrim(task.repo?.name) ||
    safeTrim(task.repoId) ||
    safeTrim(payload?.project?.path_with_namespace) ||
    safeTrim(payload?.repository?.full_name) ||
    safeTrim(payload?.repository?.name)
  );
};

const guessIssueNumber = (task: Task): number | undefined => {
  const payload: any = task.payload ?? {};
  return (
    toFiniteNumber(task.issueId) ??
    toFiniteNumber(payload?.issue?.iid) ??
    toFiniteNumber(payload?.issue?.number) ??
    toFiniteNumber(payload?.object_attributes?.iid)
  );
};

const guessMrNumber = (task: Task): number | undefined => {
  const payload: any = task.payload ?? {};
  return (
    toFiniteNumber(task.mrId) ??
    toFiniteNumber(payload?.merge_request?.iid) ??
    toFiniteNumber(payload?.pull_request?.number) ??
    toFiniteNumber(payload?.object_attributes?.iid)
  );
};

const guessCommitSha = (task: Task): string => {
  const payload: any = task.payload ?? {};
  const raw =
    payload?.after ||
    payload?.checkout_sha ||
    payload?.head_commit?.id ||
    payload?.head_commit?.sha ||
    payload?.commit?.id ||
    payload?.commit?.sha ||
    payload?.comment?.commit_id ||
    payload?.object_attributes?.commit_id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : '';
};

export const getTaskEventMarker = (task: Task): string => {
  // Build event identifier markers for the sidebar 2-line task titles. mks8pr4r3m1fo9oqx9av
  const provider = inferRepoProvider(task);
  const issueNumber = guessIssueNumber(task);
  const mrNumber = guessMrNumber(task);
  const sha = guessCommitSha(task);

  const issueMarker = issueNumber !== undefined ? `#${issueNumber}` : '';
  const mrMarker = mrNumber !== undefined ? `${provider === 'gitlab' ? '!' : '#'}${mrNumber}` : '';
  const commitMarker = sha ? shortSha(sha) : '';

  switch (task.eventType) {
    case 'issue':
    case 'issue_created':
    case 'issue_comment':
    case 'note':
      return issueMarker;
    case 'merge_request':
    case 'pull_request':
      return mrMarker;
    case 'commit':
    case 'commit_review':
      return commitMarker;
    case 'push': {
      const payload: any = task.payload ?? {};
      const ref = formatRef(task.ref || payload?.ref);
      if (ref) return `@${ref}`;
      return commitMarker;
    }
  }

  if (issueMarker) return issueMarker;
  if (mrMarker) return mrMarker;
  if (commitMarker) return commitMarker;
  return shortSha(String(task.id ?? ''), 8);
};

export const clampText = (value: string, maxLen: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
};

export const getTaskEventText = (t: TFunction, eventType: Task['eventType']): string => {
  // Centralize i18n event labels so compact task UIs (sidebar/cards) stay consistent. aw85xyfsp5zfg6ihq3jr
  switch (eventType) {
    case 'commit_review':
      return t('task.event.commit_review');
    case 'commit':
      return t('task.event.commit');
    case 'push':
      return t('task.event.push');
    case 'merge_request':
      return t('task.event.merge_request');
    case 'issue_created':
      return t('task.event.issue_created');
    case 'issue':
      return t('task.event.issue');
    case 'issue_comment':
      return t('task.event.issue_comment');
    case 'note':
      return t('task.event.note');
    case 'unknown':
      return t('task.event.unknown');
    case 'chat':
      return t('task.event.chat');
    default:
      return String(eventType);
  }
};

export const getTaskSidebarPrimaryText = (t: TFunction, task: Task): string => {
  // Prefer event + identifier as the sidebar primary line to surface more context in limited space. mks8pr4r3m1fo9oqx9av
  const marker = getTaskEventMarker(task);
  const eventText = getTaskEventText(t, task.eventType); // Reuse centralized event labels across task UIs. aw85xyfsp5zfg6ihq3jr

  return marker ? `${eventText} ${marker}` : eventText;
};

export const getTaskSidebarSecondaryText = (task: Task): string => getTaskRepoName(task);

export const extractTaskUserText = (task: Task): string => {
  // Business intent:
  // - Prefer explicit chat payload (`__chat.text`) when available.
  // - Fall back to provider comment bodies for webhook-triggered tasks.
  // - Finally, use the task title for issue/MR/commit-like tasks.
  const payload: any = task.payload ?? {};
  const direct = payload?.__chat?.text;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const gitlabNote = payload?.object_attributes?.note;
  if (typeof gitlabNote === 'string' && gitlabNote.trim()) return gitlabNote.trim();

  const githubComment = payload?.comment?.body;
  if (typeof githubComment === 'string' && githubComment.trim()) return githubComment.trim();

  const title = String(task.title ?? '').trim();
  return title;
};

export const extractTaskResultText = (task?: Task | null): string => {
  const result = task?.result ?? {};
  const outputText = typeof (result as any)?.outputText === 'string' ? String((result as any).outputText).trim() : '';
  if (outputText) return outputText;
  const summary = typeof (result as any)?.summary === 'string' ? String((result as any).summary).trim() : '';
  if (summary) return summary;
  const message = typeof (result as any)?.message === 'string' ? String((result as any).message).trim() : '';
  if (message) return message;
  const logs = Array.isArray((result as any)?.logs) ? (result as any).logs.filter((v: unknown) => typeof v === 'string') : [];
  if (logs.length) return logs.join('\n');
  return '';
};

export const formatRef = (ref?: string) => {
  if (!ref) return ref;
  return ref.replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, '');
};

export const projectWebUrl = (payload: any): string | undefined => {
  const raw =
    payload?.project?.web_url ||
    payload?.project?.homepage ||
    payload?.repository?.homepage ||
    payload?.repository?.html_url ||
    payload?.project?.http_url ||
    payload?.project?.git_http_url ||
    payload?.project?.http_url_to_repo;

  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  return trimmed.replace(/\.git$/, '').replace(/\/$/, '');
};

export const eventTag = (t: TFunction, eventType: Task['eventType']) => {
  const map: Record<string, { color: string }> = {
    commit_review: { color: 'cyan' },
    commit: { color: 'cyan' },
    push: { color: 'cyan' },
    merge_request: { color: 'geekblue' },
    issue_created: { color: 'volcano' },
    issue: { color: 'volcano' },
    issue_comment: { color: 'purple' },
    note: { color: 'purple' },
    unknown: { color: 'default' },
    chat: { color: 'blue' }
  };
  const item = map[eventType] ?? { color: 'default' };
  return <Tag color={item.color}>{getTaskEventText(t, eventType)}</Tag>;
};

export const extractUser = (payload: any) => {
  const sender = payload?.sender;
  if (sender) {
    return {
      name: sender.login ?? sender.name ?? '',
      username: sender.login ?? '',
      avatar: sender.avatar_url ?? ''
    };
  }

  const user = payload?.user;
  if (user) {
    return {
      name: user.name ?? '',
      username: user.username ?? '',
      avatar: user.avatar_url ?? ''
    };
  }

  const name: string | undefined = payload?.user_name;
  const username: string | undefined = payload?.user_username;
  const avatar: string | undefined = payload?.user_avatar;

  if (!name && !username && !avatar) return undefined;

  return {
    name: name ?? username ?? '',
    username: username ?? '',
    avatar: avatar ?? ''
  };
};

export const extractTargetLink = (t: TFunction, task: Task): { href: string; text: string } | undefined => {
  const payload: any = task.payload;
  const projectUrl = projectWebUrl(payload);
  const isGithubRepo = Boolean(payload?.repository?.html_url || payload?.repository?.full_name);

  const buildCommitUrl = (sha: string): string | undefined => {
    if (!projectUrl) return undefined;
    if (isGithubRepo) return `${projectUrl}/commit/${sha}`;
    return `${projectUrl}/-/commit/${sha}`;
  };

  const guessCommitSha = (): string | undefined => {
    const raw =
      payload?.after ||
      payload?.checkout_sha ||
      payload?.head_commit?.id ||
      payload?.head_commit?.sha ||
      payload?.commit?.id ||
      payload?.commit?.sha ||
      payload?.comment?.commit_id ||
      payload?.object_attributes?.commit_id;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
  };

  switch (task.eventType) {
    case 'issue_comment':
    case 'note':
      if (payload?.comment?.html_url) return { href: payload.comment.html_url, text: t('task.target.viewNote') };
      if (payload?.object_attributes?.url) return { href: payload.object_attributes.url, text: t('task.target.viewNote') };
      break;
    case 'issue_created':
    case 'issue':
      if (payload?.issue?.html_url) return { href: payload.issue.html_url, text: t('task.target.viewIssue') };
      if (projectUrl) {
        const iid = task.issueId ?? payload?.object_attributes?.iid ?? payload?.issue?.iid;
        if (iid) return { href: `${projectUrl}/-/issues/${iid}`, text: t('task.target.viewIssue') };
      }
      break;
    case 'merge_request':
      if (projectUrl) {
        const iid = task.mrId ?? payload?.object_attributes?.iid ?? payload?.merge_request?.iid;
        if (iid) return { href: `${projectUrl}/-/merge_requests/${iid}`, text: t('task.target.viewMr') };
      }
      break;
    case 'commit':
      if (projectUrl) {
        const sha = guessCommitSha();
        const href = sha ? buildCommitUrl(sha) : undefined;
        if (href) return { href, text: t('task.target.viewCommit') };
      }
      if (payload?.comment?.html_url) return { href: payload.comment.html_url, text: t('task.target.viewNote') };
      if (payload?.object_attributes?.url) return { href: payload.object_attributes.url, text: t('task.target.viewNote') };
    case 'commit_review':
    case 'push':
      if (projectUrl) {
        const ref = formatRef(task.ref || payload?.ref);
        if (!ref) return undefined;
        if (payload?.repository?.html_url || payload?.repository?.full_name) {
          return { href: `${projectUrl}/tree/${encodeURIComponent(ref)}`, text: t('task.target.viewBranch') };
        }
        return { href: `${projectUrl}/-/tree/${encodeURIComponent(ref)}`, text: t('task.target.viewBranch') };
      }
      break;
  }
  return undefined;
};

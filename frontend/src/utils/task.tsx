import { Tag } from 'antd';
import type { Task, TaskStatus } from '../api';
import type { TFunction } from '../i18n';

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

export const clampText = (value: string, maxLen: number): string => {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, Math.max(0, maxLen - 1))}…`;
};

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
  const map: Record<string, { color: string; text: string }> = {
    commit_review: { color: 'cyan', text: t('task.event.commit_review') },
    commit: { color: 'cyan', text: t('task.event.commit') },
    push: { color: 'cyan', text: t('task.event.push') },
    merge_request: { color: 'geekblue', text: t('task.event.merge_request') },
    issue_created: { color: 'volcano', text: t('task.event.issue_created') },
    issue: { color: 'volcano', text: t('task.event.issue') },
    issue_comment: { color: 'purple', text: t('task.event.issue_comment') },
    note: { color: 'purple', text: t('task.event.note') },
    unknown: { color: 'default', text: t('task.event.unknown') },
    chat: { color: 'blue', text: t('task.event.chat') }
  };
  const item = map[eventType] ?? { color: 'default', text: String(eventType) };
  return <Tag color={item.color}>{item.text}</Tag>;
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

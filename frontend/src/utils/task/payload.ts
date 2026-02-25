// Extract task payload parsing helpers for link and user info. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { Task } from '../api';
import type { TFunction } from '../i18n';
import { formatRef } from './labels';

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

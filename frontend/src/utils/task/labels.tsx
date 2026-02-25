// Extract task label and marker helpers for consistent UI text. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203

import type { Task } from '../api';
import type { TFunction } from '../i18n';

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

export const formatRef = (ref?: string) => {
  if (!ref) return ref;
  return ref.replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, '');
};

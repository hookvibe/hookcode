import { getBotUsernames } from '../../agent/robots';
import type { RepoRobot } from '../../types/repoRobot';
import type { TaskEventType } from '../../types/task';
import type { CreateGuardResult } from './webhook.types';
import { extractSubType } from './webhook.automation';
import { hasNewCommits, isGitlabZeroSha, shouldIgnorePushByCherryPick, shouldIgnorePushByMergeCommit } from './webhook.commit';

// Split webhook guard helpers into a dedicated module for reuse across providers. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export const isInlineWorkerEnabled = (): boolean => {
  const raw = (process.env.INLINE_WORKER_ENABLED ?? '').trim().toLowerCase();
  if (!raw) return true;
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
};

const isSelfNoteGitlab = (payload: any, botUsernames: string[]) => {
  const username: string | undefined = payload?.user?.username || payload?.user?.name;
  const authorId = payload?.object_attributes?.author_id;
  const system = payload?.object_attributes?.system;
  if (system) return true;
  if (!username) return false;
  return botUsernames.includes(username.toLowerCase()) || botUsernames.includes(String(authorId));
};

const isBotActorGitlab = (payload: any, botUsernames: string[]) => {
  const username: string | undefined = payload?.user?.username || payload?.user?.name;
  if (!username) return false;
  return botUsernames.includes(username.toLowerCase());
};

/**
 * Automation config (new system) pre-check before enqueuing tasks:
 * - Only filters "obviously meaningless/high-noise" events (e.g. branch deletes, edited comments, bot self-triggers)
 * - Whether it should trigger is decided by repo automation config (resolveAutomationActions)
 */
export const canCreateGitlabAutomationTask = (
  eventType: TaskEventType,
  payload: any,
  robots: RepoRobot[]
): CreateGuardResult => {
  const botUsernames = getBotUsernames(robots);
  const subType = extractSubType(payload);

  // Unified filtering for comment events: ignore edits and bot self-triggers.
  if (subType === 'commented') {
    if (payload?.object_attributes?.action === 'update') {
      return { allowed: false, reason: 'note update ignored' };
    }
    if (isSelfNoteGitlab(payload, botUsernames)) {
      return { allowed: false, reason: 'self note ignored' };
    }
    return { allowed: true };
  }

  if (eventType === 'commit' && subType === 'created') {
    const ref: string | undefined = payload?.ref;
    if (ref && !ref.startsWith('refs/heads/')) {
      return { allowed: false, reason: `push ref ${ref} ignored (not a branch)` };
    }

    const after: string | undefined = payload?.checkout_sha ?? payload?.after;
    if (after && after.length >= 40 && isGitlabZeroSha(after)) {
      return { allowed: false, reason: 'push delete ignored' };
    }
    if (!hasNewCommits(payload)) {
      return { allowed: false, reason: 'push without commits ignored' };
    }

    const mergeIgnored = shouldIgnorePushByMergeCommit(payload);
    if (mergeIgnored.ignored) return { allowed: false, reason: mergeIgnored.reason ?? 'merge commit ignored' };

    const cherryPickIgnored = shouldIgnorePushByCherryPick(payload);
    if (cherryPickIgnored.ignored) return { allowed: false, reason: cherryPickIgnored.reason ?? 'cherry-pick commit ignored' };

    return { allowed: true };
  }

  if (eventType === 'issue' && subType === 'created') {
    const action = payload?.object_attributes?.action;
    if (action && action !== 'open' && action !== 'create') {
      return { allowed: false, reason: `issue action ${action} ignored` };
    }
    if (isBotActorGitlab(payload, botUsernames)) {
      return { allowed: false, reason: 'bot issue ignored' };
    }
    return { allowed: true };
  }

  if (eventType === 'merge_request' && (subType === 'created' || subType === 'updated')) {
    if (isBotActorGitlab(payload, botUsernames)) {
      return { allowed: false, reason: 'bot merge request ignored' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'event type not enabled yet' };
};

export const canCreateGithubAutomationTask = (
  eventType: TaskEventType,
  payload: any,
  robots: RepoRobot[]
): CreateGuardResult => {
  const botUsernames = getBotUsernames(robots);
  const subType = extractSubType(payload);

  if (eventType === 'commit' && subType === 'created') {
    if (payload?.deleted) return { allowed: false, reason: 'push delete ignored' };
    if (!hasNewCommits(payload)) return { allowed: false, reason: 'push without commits ignored' };

    const mergeIgnored = shouldIgnorePushByMergeCommit(payload);
    if (mergeIgnored.ignored) return { allowed: false, reason: mergeIgnored.reason ?? 'merge commit ignored' };

    const cherryPickIgnored = shouldIgnorePushByCherryPick(payload);
    if (cherryPickIgnored.ignored) return { allowed: false, reason: cherryPickIgnored.reason ?? 'cherry-pick commit ignored' };

    return { allowed: true };
  }

  if (eventType === 'commit' && subType === 'commented') {
    const sender = String(payload?.sender?.login ?? payload?.comment?.user?.login ?? '').toLowerCase();
    if (sender && botUsernames.includes(sender)) return { allowed: false, reason: 'self comment ignored' };
    return { allowed: true };
  }

  if (eventType === 'issue' && subType === 'created') {
    const action = payload?.action;
    if (action && action !== 'opened') {
      return { allowed: false, reason: `issue action ${action} ignored` };
    }
    const sender = String(payload?.sender?.login ?? '').toLowerCase();
    if (sender && botUsernames.includes(sender)) {
      return { allowed: false, reason: 'bot issue ignored' };
    }
    return { allowed: true };
  }

  if (eventType === 'issue' && subType === 'commented') {
    const sender = String(payload?.sender?.login ?? '').toLowerCase();
    if (sender && botUsernames.includes(sender)) {
      return { allowed: false, reason: 'self comment ignored' };
    }
    return { allowed: true };
  }

  if (eventType === 'merge_request' && (subType === 'created' || subType === 'updated')) {
    const sender = String(payload?.sender?.login ?? payload?.pull_request?.user?.login ?? '').toLowerCase();
    if (sender && botUsernames.includes(sender)) return { allowed: false, reason: 'bot pull request ignored' };
    return { allowed: true };
  }

  if (eventType === 'merge_request' && subType === 'commented') {
    const sender = String(payload?.sender?.login ?? '').toLowerCase();
    if (sender && botUsernames.includes(sender)) return { allowed: false, reason: 'self comment ignored' };
    return { allowed: true };
  }

  return { allowed: false, reason: 'event type not enabled yet' };
};

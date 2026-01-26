import type { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import type { TaskService, TaskCreateMeta } from '../tasks/task.service';
import type { TaskRunner } from '../tasks/task-runner.service';
import type { RepositoryService } from '../repositories/repository.service';
import type { RepoRobotService } from '../repositories/repo-robot.service';
import type { RepoAutomationService } from '../repositories/repo-automation.service';
import type { RepoWebhookDeliveryService } from '../repositories/repo-webhook-delivery.service';
import { TaskEventType } from '../../types/task';
import { getBotUsernames } from '../../agent/robots';
import {
  buildRepoHydrationPatch,
  deriveRepoIdentityFromWebhook,
  deriveRepoNameFromWebhook
} from '../../services/repoHydration';
import { resolveAutomationActions } from '../../services/automationEngine';
import type { RepoProvider } from '../../types/repository';
import type { RepoRobot } from '../../types/repoRobot';
import { attachTaskSchedule, isTimeWindowActive, resolveTaskSchedule } from '../../utils/timeWindow';

/**
 * Webhook endpoints (trigger mode):
 * - POST `/api/webhook/gitlab/:repoId` (mounted in `backend/src/app.ts`)
 * - POST `/api/webhook/github/:repoId`
 * - Maps platform hooks (Push/MR/Issue/Comment, etc.) into internal `TaskEventType` and enqueues them in DB (see `backend/src/services/taskService.ts`).
 * - If INLINE_WORKER is enabled (enabled by default), triggers `taskRunner.trigger()` asynchronously to consume the queue (see `backend/src/services/taskRunner.ts`);
 *   otherwise it only enqueues and waits for the standalone worker (see `backend/src/worker.ts`).
 * - Comment-type events are first filtered for noise (edits/bot self-trigger, etc.); whether to trigger is decided by repo "trigger/automation config"
 *   (see `resolveAutomationActions`).
 *
 */
export interface WebhookDeps {
  taskService: TaskService;
  taskRunner: TaskRunner;
  repositoryService: RepositoryService;
  repoRobotService: RepoRobotService;
  repoAutomationService: RepoAutomationService;
  repoWebhookDeliveryService: RepoWebhookDeliveryService;
}

/**
 * Automation config (new system) event mapping:
 * - Covers: issue / commit / merge_request
 * - Can be extended with more events later
 */
type AutomationEventMapping = { eventType: TaskEventType; subType: string };

const mapGitlabAutomationEvent = (eventName?: string, payload?: any): AutomationEventMapping | null => {
  switch (eventName) {
    case 'Push Hook':
      return { eventType: 'commit', subType: 'created' };
    case 'Issue Hook':
      return { eventType: 'issue', subType: 'created' };
    case 'Merge Request Hook': {
      const action = payload?.object_attributes?.action;
      if (!action || action === 'open' || action === 'reopen' || action === 'create') {
        return { eventType: 'merge_request', subType: 'created' };
      }
      if (action === 'update') {
        return { eventType: 'merge_request', subType: 'updated' };
      }
      return null;
    }
    case 'Note Hook': {
      const noteableType = payload?.object_attributes?.noteable_type;
      if (noteableType === 'Issue') return { eventType: 'issue', subType: 'commented' };
      if (noteableType === 'MergeRequest') return { eventType: 'merge_request', subType: 'commented' };
      if (noteableType === 'Commit') return { eventType: 'commit', subType: 'commented' };
      return null;
    }
    default:
      return null;
  }
};

const mapGithubAutomationEvent = (eventName?: string, payload?: any): AutomationEventMapping | null => {
  switch (eventName) {
    case 'push':
      return { eventType: 'commit', subType: 'created' };
    case 'issues': {
      const action = payload?.action;
      if (!action || action === 'opened' || action === 'reopened') {
        return { eventType: 'issue', subType: 'created' };
      }
      return null;
    }
    case 'issue_comment': {
      const action = payload?.action;
      if (action && action !== 'created') return null;
      const isPr = Boolean(payload?.issue?.pull_request);
      return { eventType: isPr ? 'merge_request' : 'issue', subType: 'commented' };
    }
    case 'pull_request': {
      const action = payload?.action;
      if (!action || action === 'opened' || action === 'reopened') {
        return { eventType: 'merge_request', subType: 'created' };
      }
      if (action === 'synchronize' || action === 'edited') {
        return { eventType: 'merge_request', subType: 'updated' };
      }
      return null;
    }
    case 'commit_comment': {
      const action = payload?.action;
      if (action && action !== 'created') return null;
      return { eventType: 'commit', subType: 'commented' };
    }
    default:
      return null;
  }
};

const extractSubType = (payload: any): string =>
  typeof payload?.__subType === 'string' ? payload.__subType.trim() : '';

const buildTaskTitle = (eventType: TaskEventType, payload: any): string | undefined => {
  const projectName: string | undefined = payload?.project?.path_with_namespace;
  const subType = extractSubType(payload);
  switch (eventType) {
    case 'commit': {
      if (subType === 'commented') {
        const note = (payload?.object_attributes?.note as string | undefined)?.trim();
        const ghNote = (payload?.comment?.body as string | undefined)?.trim();
        const raw = note ?? ghNote;
        const snippet = raw ? raw.replace(/\s+/g, ' ').slice(0, 80) : '';
        return [snippet ? 'CommitComment' : 'Commit', projectName, snippet].filter(Boolean).join(' · ');
      }
      const ref = payload?.ref;
      const commits = Array.isArray(payload?.commits) ? payload.commits : [];
      const after = payload?.after;
      const headCommit =
        typeof after === 'string' && commits.length
          ? commits.find((c: any) => c?.id === after || c?.sha === after) ?? commits[commits.length - 1]
          : commits.length
            ? commits[commits.length - 1]
            : undefined;
      const commitSha: string | undefined =
        typeof headCommit?.id === 'string'
          ? headCommit.id
          : typeof headCommit?.sha === 'string'
            ? headCommit.sha
            : typeof after === 'string'
              ? after
              : undefined;
      const commitShort = commitSha ? commitSha.slice(0, 8) : '';
      const commitTitle = extractCommitTitle(headCommit);
      const snippet = commitTitle ? commitTitle.replace(/\s+/g, ' ').slice(0, 80) : '';
      if (projectName || ref) {
        const base = ['Commit', projectName, ref].filter(Boolean).join(' ');
        const extra = [commitShort, snippet].filter(Boolean).join(' · ');
        return extra ? `${base} · ${extra}` : base;
      }
      break;
    }
    case 'commit_review':
    case 'push': {
      const ref = payload?.ref;
      const label = eventType === 'commit_review' ? 'CommitReview' : 'Push';
      if (projectName || ref) return [label, projectName, ref].filter(Boolean).join(' ');
      break;
    }
    case 'merge_request': {
      if (subType === 'commented') {
        const note = (payload?.object_attributes?.note as string | undefined)?.trim();
        const ghNote = (payload?.comment?.body as string | undefined)?.trim();
        const raw = note ?? ghNote;
        const snippet = raw ? raw.replace(/\s+/g, ' ').slice(0, 80) : '';
        const mrIid = payload?.merge_request?.iid ?? payload?.object_attributes?.noteable_id;
        return ['MRComment', projectName, mrIid ? `!${mrIid}` : undefined, snippet].filter(Boolean).join(' · ');
      }

      const mr = payload?.object_attributes ?? payload?.merge_request ?? payload?.pull_request;
      const iid = mr?.iid ?? mr?.number;
      const title = mr?.title;
      const label = subType === 'updated' ? 'MRUpdated' : 'MR';
      if (iid || title) return `${label}${iid ? ` !${iid}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue': {
      if (subType === 'commented') {
        const note = (payload?.object_attributes?.note as string | undefined)?.trim();
        const ghNote = (payload?.comment?.body as string | undefined)?.trim();
        const raw = note ?? ghNote;
        const snippet = raw ? raw.replace(/\s+/g, ' ').slice(0, 80) : '';
        const issueIid = payload?.issue?.iid ?? payload?.issue?.number ?? payload?.object_attributes?.noteable_id;
        return ['IssueComment', projectName, issueIid ? `#${issueIid}` : undefined, snippet].filter(Boolean).join(' · ');
      }
      const issue = payload?.object_attributes ?? payload?.issue;
      const iid = issue?.iid ?? issue?.number;
      const title = issue?.title;
      const label = subType === 'created' ? 'IssueCreated' : 'Issue';
      if (iid || title) return `${label}${iid ? ` #${iid}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue_created': {
      const issue = payload?.object_attributes ?? payload?.issue;
      const iid = issue?.iid;
      const title = issue?.title;
      const label = eventType === 'issue_created' ? 'IssueCreated' : 'Issue';
      if (iid || title) return `${label}${iid ? ` #${iid}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue_comment':
    case 'note': {
      const note = (payload?.object_attributes?.note as string | undefined)?.trim();
      const ghNote = (payload?.comment?.body as string | undefined)?.trim();
      const noteableType = payload?.object_attributes?.noteable_type;
      const mrIid = payload?.merge_request?.iid;
      const issueIid = payload?.issue?.iid;
      const target =
        noteableType === 'MergeRequest'
          ? mrIid
            ? `!${mrIid}`
            : 'MergeRequest'
          : noteableType === 'Issue'
            ? issueIid
              ? `#${issueIid}`
              : 'Issue'
            : noteableType;
      const raw = note ?? ghNote;
      const label = eventType === 'issue_comment' ? 'IssueComment' : 'Note';
      if (raw) {
        const snippet = raw.replace(/\s+/g, ' ').slice(0, 80);
        return [label, projectName, target, snippet].filter(Boolean).join(' · ');
      }
      if (target || projectName) return [label, projectName, target].filter(Boolean).join(' · ');
      break;
    }
  }
  return payload?.object_kind;
};

const buildTaskMeta = (eventType: TaskEventType, payload: any): TaskCreateMeta => {
  const meta: TaskCreateMeta = {
    title: buildTaskTitle(eventType, payload),
    projectId: payload?.project?.id ?? payload?.project_id,
    repoProvider: 'gitlab'
  };
  const subType = extractSubType(payload);

  switch (eventType) {
    case 'commit':
    case 'commit_review':
    case 'push':
      meta.ref = payload?.ref;
      break;
    case 'merge_request': {
      // GitLab Note Hook (comment) case: object_attributes is the "note", MR info is in payload.merge_request.
      const mr =
        subType === 'commented'
          ? payload?.merge_request ?? payload?.pull_request
          : payload?.object_attributes ?? payload?.merge_request ?? payload?.pull_request;
      meta.mrId = mr?.iid ?? mr?.id ?? mr?.number;
      // source_branch is only provided in the "MR hook" case; comment events may not have branch info.
      if (subType !== 'commented') {
        meta.ref = mr?.source_branch ?? mr?.head?.ref;
      }
      break;
    }
    case 'issue': {
      // GitLab Note Hook (comment) case: object_attributes is the "note", issue info is in payload.issue.
      const issue = subType === 'commented' ? payload?.issue : payload?.object_attributes ?? payload?.issue;
      meta.issueId = issue?.iid ?? issue?.id ?? issue?.number;
      break;
    }
    case 'issue_created': {
      const issue = payload?.object_attributes ?? payload?.issue;
      meta.issueId = issue?.iid ?? issue?.id;
      break;
    }
    case 'issue_comment':
    case 'note': {
      const noteableType = payload?.object_attributes?.noteable_type;
      if (noteableType === 'Issue') {
        const issue = payload?.issue;
        meta.issueId = issue?.iid ?? issue?.id ?? payload?.object_attributes?.noteable_id;
      }
      if (noteableType === 'MergeRequest') {
        const mr = payload?.merge_request;
        meta.mrId = mr?.iid ?? mr?.id ?? payload?.object_attributes?.noteable_id;
      }
      break;
    }
  }

  return meta;
};

// Unit-test only: avoid relying on Express routing behavior to indirectly verify metadata extraction logic.
export const __test__buildTaskMeta = buildTaskMeta;

interface CreateGuardResult {
  allowed: boolean;
  reason?: string;
}

const isInlineWorkerEnabled = (): boolean => {
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

const isGitlabZeroSha = (sha?: string): boolean =>
  typeof sha === 'string' && sha.length >= 40 && /^0+$/.test(sha);

const hasNewCommits = (payload: any): boolean => {
  const count = Number(payload?.total_commits_count ?? 0);
  if (Number.isFinite(count) && count > 0) return true;
  if (Array.isArray(payload?.commits) && payload.commits.length > 0) return true;
  return false;
};

const extractCommitTitle = (commit: any): string | undefined => {
  const raw = commit?.title ?? commit?.message;
  if (typeof raw !== 'string') return undefined;
  return raw.split('\n')[0].trim();
};

const extractCommitMessage = (commit: any): string | undefined => {
  const raw = commit?.message;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
};

const isMergeCommitTitle = (title: string): boolean => {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (/^merge\b/i.test(trimmed)) return true;
  // Change record (2026-01-15): keep merge detection English-only to avoid mixed-language heuristics.
  return false;
};

const isCherryPickCommit = (commit: any): boolean => {
  const title = extractCommitTitle(commit);
  const message = extractCommitMessage(commit);
  const text = [title, message].filter(Boolean).join('\n');
  if (!text) return false;

  // `git cherry-pick -x` or GitLab UI cherry-pick often includes this kind of trailer.
  if (/cherry[- ]picked from commit\s+[0-9a-f]{7,40}/i.test(text)) return true;

  // Fallback: title/body contains the cherry-pick keyword (allow some false positives to avoid duplicate reviews).
  if (/\bcherry[- ]pick\b/i.test(text)) return true;
  // Change record (2026-01-15): keep cherry-pick detection English-only to avoid mixed-language heuristics.

  return false;
};

const shouldIgnorePushByCherryPick = (payload: any): { ignored: boolean; reason?: string } => {
  const commits: any[] = Array.isArray(payload?.commits) ? payload.commits : [];
  if (!commits.length) return { ignored: false };

  // Skip only when *all* commits in this push are cherry-picks;
  // if mixed with normal commits, still trigger review (avoid missing reviews).
  const allCherryPick = commits.every((c) => isCherryPickCommit(c));
  if (!allCherryPick) return { ignored: false };

  const sampleTitle = extractCommitTitle(commits[commits.length - 1] ?? commits[0]);
  const sample = sampleTitle ? sampleTitle.slice(0, 80) : undefined;
  return { ignored: true, reason: sample ? `cherry-pick commit ignored (e.g. "${sample}")` : 'cherry-pick commit ignored' };
};

const shouldIgnorePushByMergeCommit = (payload: any): { ignored: boolean; reason?: string } => {
  const headSha: string | undefined = payload?.checkout_sha ?? payload?.after;
  const commits: any[] = Array.isArray(payload?.commits) ? payload.commits : [];
  if (!headSha || !commits.length) return { ignored: false };

  const head = commits.find((c) => (c?.id ?? c?.sha) === headSha) ?? (commits.length === 1 ? commits[0] : undefined);
  const title = head ? extractCommitTitle(head) : undefined;
  if (!title) return { ignored: false };

  if (!isMergeCommitTitle(title)) return { ignored: false };

  const sample = title.slice(0, 80);
  return { ignored: true, reason: `merge commit ignored (e.g. "${sample}")` };
};

/**
 * Automation config (new system) pre-check before enqueuing tasks:
 * - Only filters "obviously meaningless/high-noise" events (e.g. branch deletes, edited comments, bot self-triggers)
 * - Whether it should trigger is decided by repo automation config (resolveAutomationActions)
 */
const canCreateGitlabAutomationTask = (
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

const canCreateGithubAutomationTask = (
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

const constantTimeEqualHex = (aHex: string, bHex: string): boolean => {
  const a = Buffer.from(aHex, 'utf8');
  const b = Buffer.from(bHex, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
};

const verifyGitlabSecret = (req: any, secret: string | null): { ok: boolean; reason?: string } => {
  if (!secret) return { ok: true };
  const header = (req.header('x-gitlab-token') ?? req.header('X-Gitlab-Token') ?? '').trim();
  if (!header) return { ok: false, reason: 'missing x-gitlab-token' };
  return header === secret ? { ok: true } : { ok: false, reason: 'invalid x-gitlab-token' };
};

const verifyGithubSecret = (req: any, secret: string | null): { ok: boolean; reason?: string } => {
  if (!secret) return { ok: true };
  const sig256 = (req.header('x-hub-signature-256') ?? '').trim();
  if (!sig256) return { ok: false, reason: 'missing x-hub-signature-256' };

  const rawBody: Buffer | undefined = req.rawBody;
  if (!rawBody) return { ok: false, reason: 'missing rawBody (server misconfigured)' };

  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedHeader = `sha256=${expected}`;
  return constantTimeEqualHex(expectedHeader, sig256) ? { ok: true } : { ok: false, reason: 'invalid signature' };
};

const normalizeApiBaseUrlForCompare = (provider: RepoProvider, value: string): string => {
  let url = value.trim().replace(/\/+$/, '');
  if (provider === 'gitlab') {
    url = url.replace(/\/api\/v4$/i, '');
  }
  return url;
};

const deriveExternalIdCandidates = (provider: RepoProvider, payload: any): string[] => {
  const ids = new Set<string>();
  const derived = deriveRepoIdentityFromWebhook(provider, payload).externalId;
  if (typeof derived === 'string' && derived.trim()) ids.add(derived.trim());

  if (provider === 'github') {
    const full = typeof payload?.repository?.full_name === 'string' ? payload.repository.full_name.trim() : '';
    if (full) ids.add(full);
    const numId = payload?.repository?.id;
    if (typeof numId === 'number' && Number.isFinite(numId)) ids.add(String(numId));
  }

  return Array.from(ids);
};

const validateRepoWebhookBinding = (
  provider: RepoProvider,
  repo: { externalId?: string; apiBaseUrl?: string },
  payload: any
): { ok: true; derived: ReturnType<typeof deriveRepoIdentityFromWebhook>; externalIdCandidates: string[] } | { ok: false; status: number; body: any } => {
  const derived = deriveRepoIdentityFromWebhook(provider, payload);
  const externalIdCandidates = deriveExternalIdCandidates(provider, payload);
  if (!externalIdCandidates.length) {
    return {
      ok: false,
      status: 400,
      body: { error: 'Webhook payload is missing repository identity', code: 'WEBHOOK_REPO_ID_MISSING' }
    };
  }

  const expectedExternalId = (repo.externalId ?? '').trim();
  if (expectedExternalId && !externalIdCandidates.includes(expectedExternalId)) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Webhook repository mismatch',
        code: 'WEBHOOK_REPO_BINDING_MISMATCH',
        expectedExternalId,
        actualExternalIds: externalIdCandidates
      }
    };
  }

  const expectedBaseUrl = (repo.apiBaseUrl ?? '').trim();
  const actualBaseUrl = (derived.apiBaseUrl ?? '').trim();
  if (expectedBaseUrl && actualBaseUrl) {
    const expectedNormalized = normalizeApiBaseUrlForCompare(provider, expectedBaseUrl);
    const actualNormalized = normalizeApiBaseUrlForCompare(provider, actualBaseUrl);
    if (expectedNormalized && actualNormalized && expectedNormalized !== actualNormalized) {
      return {
        ok: false,
        status: 409,
        body: {
          error: 'Webhook apiBaseUrl mismatch',
          code: 'WEBHOOK_REPO_BASE_URL_MISMATCH',
          expectedApiBaseUrl: expectedNormalized,
          actualApiBaseUrl: actualNormalized
        }
      };
    }
  }

  return { ok: true, derived, externalIdCandidates };
};

const normalizeRepoNameForCompare = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
};

const isSlugLikeRepoName = (value: string): boolean => /^[a-z0-9][a-z0-9._-]*$/i.test(value);

const validateRepoWebhookNameBinding = (
  provider: RepoProvider,
  repo: { name?: string | null; externalId?: string | null },
  payload: any
): { ok: true } | { ok: false; status: number; body: any } => {
  const expectedExternalId = (repo.externalId ?? '').trim();
  if (expectedExternalId) return { ok: true };

  const expectedName = normalizeRepoNameForCompare(repo.name ?? '');
  if (!expectedName) return { ok: true };

  const derivedName = deriveRepoNameFromWebhook(provider, payload);
  const actualName = normalizeRepoNameForCompare(derivedName ?? '');
  if (!actualName) return { ok: true };

  const expectedLower = expectedName.toLowerCase();
  const actualLower = actualName.toLowerCase();
  if (expectedName.includes('/')) {
    if (expectedLower === actualLower) return { ok: true };
  } else if (isSlugLikeRepoName(expectedName) && actualName.includes('/')) {
    const actualLast = actualName.split('/').pop() ?? '';
    if (actualLast && actualLast.toLowerCase() === expectedLower) return { ok: true };
  } else if (expectedLower === actualLower) {
    return { ok: true };
  } else {
    // Not enough signal (non-slug-like configured name), skip name binding.
    return { ok: true };
  }

  if (expectedLower !== actualLower) {
    return {
      ok: false,
      status: 409,
      body: {
        error: 'Webhook repository name mismatch',
        code: 'WEBHOOK_REPO_NAME_MISMATCH',
        expectedName,
        actualName
      }
    };
  }

  return { ok: true };
};

const safeString = (value: unknown): string => (typeof value === 'string' ? value : '');

/**
 * Webhook ingress guard (Webhook module -> provider routing):
 * - Business behavior: detect provider-mismatch deliveries (e.g., GitHub headers hitting the GitLab endpoint) and return a clear 400.
 * - Key steps: if the expected provider event header is absent, look for the other provider's signature/event/user-agent hints.
 * - Change record (2026-01-15): added mismatch detection to avoid misleading "missing x-gitlab-token"/"missing x-hub-signature-256" errors.
 * - Usage: called before secret verification in each provider handler to short-circuit with a provider hint.
 * - Notes/pitfalls: detection is heuristic and we intentionally do NOT auto-route requests across providers for security clarity.
 */
const detectWebhookProviderMismatch = (
  expectedProvider: RepoProvider,
  req: Request,
  expectedEventName: string
): { expectedProvider: RepoProvider; detectedProvider: RepoProvider; hint: string; message: string } | null => {
  const userAgent = safeString(req.header('user-agent') ?? '').trim();
  const hasGitlabEvent = Boolean(safeString(req.header('x-gitlab-event') ?? '').trim());
  const hasGitlabToken = Boolean(safeString(req.header('x-gitlab-token') ?? req.header('X-Gitlab-Token') ?? '').trim());
  const hasGitlabDelivery = Boolean(safeString(req.header('x-gitlab-event-uuid') ?? req.header('X-Gitlab-Event-UUID') ?? '').trim());
  const hasGithubEvent = Boolean(safeString(req.header('x-github-event') ?? '').trim());
  const hasGithubDelivery = Boolean(safeString(req.header('x-github-delivery') ?? '').trim());
  const hasGithubSignature = Boolean(
    safeString(req.header('x-hub-signature-256') ?? req.header('x-hub-signature') ?? '').trim()
  );
  const looksGithub = hasGithubEvent || hasGithubDelivery || hasGithubSignature || /github-hookshot/i.test(userAgent);
  const looksGitlab = hasGitlabEvent || hasGitlabToken || hasGitlabDelivery;

  if (expectedEventName) return null;

  if (expectedProvider === 'gitlab' && looksGithub) {
    return {
      expectedProvider: 'gitlab',
      detectedProvider: 'github',
      hint: '/api/webhook/github/:repoId',
      message: 'github webhook headers detected on gitlab endpoint'
    };
  }

  if (expectedProvider === 'github' && looksGitlab) {
    return {
      expectedProvider: 'github',
      detectedProvider: 'gitlab',
      hint: '/api/webhook/gitlab/:repoId',
      message: 'gitlab webhook headers detected on github endpoint'
    };
  }

  return null;
};

const recordWebhookDeliveryBestEffort = async (
  repoWebhookDeliveryService: RepoWebhookDeliveryService,
  input: {
    repoId: string;
    provider: RepoProvider;
    eventName?: string;
    deliveryId?: string;
    payload: any;
    httpStatus: number;
    result: 'accepted' | 'skipped' | 'rejected' | 'error';
    code?: string;
    message?: string;
    taskIds?: string[];
    response?: any;
  }
) => {
  try {
    await repoWebhookDeliveryService.createDelivery({
      repoId: input.repoId,
      provider: input.provider,
      eventName: input.eventName ?? null,
      deliveryId: input.deliveryId ?? null,
      result: input.result,
      httpStatus: input.httpStatus,
      code: input.code ?? null,
      message: input.message ?? null,
      taskIds: input.taskIds ?? [],
      payload: input.payload,
      response: input.response
    });
  } catch (err) {
    console.warn('[webhook] record delivery failed (ignored)', err);
  }
};

export const handleGitlabWebhook = async (req: Request, res: Response, deps: WebhookDeps) => {
  const { taskService, taskRunner, repositoryService, repoRobotService, repoAutomationService, repoWebhookDeliveryService } = deps;
  const repoId = String(req.params.repoId ?? '').trim();
  const eventName = safeString(req.header('x-gitlab-event') ?? '').trim();
  const deliveryId = safeString(req.header('x-gitlab-event-uuid') ?? req.header('X-Gitlab-Event-UUID') ?? '').trim();
  const basePayload = req.body;

  let canRecord = false;
  const respond = async (
    httpStatus: number,
    body: any,
    meta: { result: 'accepted' | 'skipped' | 'rejected' | 'error'; code?: string; message?: string; taskIds?: string[] }
  ) => {
    if (canRecord) {
      await recordWebhookDeliveryBestEffort(repoWebhookDeliveryService, {
        repoId,
        provider: 'gitlab',
        eventName,
        deliveryId,
        payload: basePayload,
        httpStatus,
        result: meta.result,
        code: meta.code,
        message: meta.message,
        taskIds: meta.taskIds,
        response: body
      });
    }
    return res.status(httpStatus).json(body);
  };

  try {
    const repoAuth = await repositoryService.getByIdWithSecret(repoId);
    if (!repoAuth) return res.status(404).json({ error: 'Repo not found' });
    canRecord = true;

    // Do not accept events for archived repos to keep the Archive area stable. qnp1mtxhzikhbi0xspbc
    if (repoAuth.repo.archivedAt) {
      return respond(202, { skipped: true, reason: 'repo archived' }, { result: 'skipped', message: 'repo archived' });
    }
    if (!repoAuth.repo.enabled) {
      return respond(202, { skipped: true, reason: 'repo disabled' }, { result: 'skipped', message: 'repo disabled' });
    }
    if (repoAuth.repo.provider !== 'gitlab') {
      return respond(400, { error: 'Repo provider mismatch' }, { result: 'rejected', message: 'Repo provider mismatch' });
    }

    if (eventName && /^system hook$/i.test(eventName)) {
      return respond(
        400,
        { error: 'System hooks are not supported; please configure a project webhook', code: 'WEBHOOK_SCOPE_NOT_SUPPORTED' },
        { result: 'rejected', code: 'WEBHOOK_SCOPE_NOT_SUPPORTED', message: 'system hook not supported' }
      );
    }

    // Webhook ingress guard: block GitHub-delivered requests hitting the GitLab endpoint with a clear provider hint. (Change record: 2026-01-15)
    const providerMismatch = detectWebhookProviderMismatch('gitlab', req, eventName);
    if (providerMismatch) {
      return respond(
        400,
        {
          error: 'Webhook provider mismatch',
          code: 'WEBHOOK_PROVIDER_MISMATCH',
          expectedProvider: providerMismatch.expectedProvider,
          detectedProvider: providerMismatch.detectedProvider,
          hint: providerMismatch.hint
        },
        { result: 'rejected', code: 'WEBHOOK_PROVIDER_MISMATCH', message: providerMismatch.message }
      );
    }

    const verify = verifyGitlabSecret(req, repoAuth.webhookSecret);
    if (!verify.ok) {
      return respond(401, { error: 'Unauthorized', reason: verify.reason }, { result: 'rejected', code: 'UNAUTHORIZED', message: verify.reason });
    }

    const nameBinding = validateRepoWebhookNameBinding('gitlab', repoAuth.repo, req.body);
    if (!nameBinding.ok) {
      const code = safeString(nameBinding.body?.code ?? '').trim() || undefined;
      const message = safeString(nameBinding.body?.error ?? '').trim() || safeString(nameBinding.body?.reason ?? '').trim() || undefined;
      return respond(nameBinding.status, nameBinding.body, { result: 'rejected', code, message });
    }

    const binding = validateRepoWebhookBinding('gitlab', repoAuth.repo, req.body);
    if (!binding.ok) {
      const code = safeString(binding.body?.code ?? '').trim() || undefined;
      const message = safeString(binding.body?.error ?? '').trim() || safeString(binding.body?.reason ?? '').trim() || undefined;
      return respond(binding.status, binding.body, { result: 'rejected', code, message });
    }

    // Before marking verified, ensure repo identity is persisted (bind-on-first-delivery).
    const patch = buildRepoHydrationPatch('gitlab', repoAuth.repo, req.body);
    if (Object.keys(patch).length) {
      try {
        await repositoryService.updateRepository(repoId, patch);
      } catch (err) {
        // When binding externalId/apiBaseUrl fails, we must not mark the repo as verified.
        const mustBind = Boolean(patch.externalId || patch.apiBaseUrl);
        if (mustBind) {
          console.error('[webhook] hydrate repo identity failed', err);
          return respond(
            409,
            { error: 'Failed to bind webhook to repository identity', code: 'WEBHOOK_BIND_FAILED' },
            { result: 'rejected', code: 'WEBHOOK_BIND_FAILED', message: 'Failed to bind webhook to repository identity' }
          );
        }
        console.warn('[webhook] hydrate repo config failed (ignored)', err);
      }
    }

    await repositoryService.markWebhookVerified(repoId);

    const robots = (await repoRobotService.listByRepo(repoId)).filter((r) => r.enabled);
    if (!robots.length) {
      return respond(202, { skipped: true, reason: 'no enabled robot configured' }, { result: 'skipped', message: 'no enabled robot configured' });
    }

    const mapped = mapGitlabAutomationEvent(eventName, req.body);
    if (!mapped) {
      return respond(202, { skipped: true, reason: 'event not supported' }, { result: 'skipped', message: 'event not supported' });
    }
    const eventType = mapped.eventType;
    const payload = { ...req.body, __subType: mapped.subType };

    const { allowed, reason } = canCreateGitlabAutomationTask(eventType, payload, robots);
    console.log('[webhook] gitlab repo', repoId, 'event', eventType, 'allowed:', allowed, reason ? `reason: ${reason}` : '');
    if (!allowed) {
      return respond(202, { skipped: true, reason }, { result: 'skipped', message: reason });
    }

    const automationConfig = await repoAutomationService.getConfig(repoId);
    const actions = resolveAutomationActions({
      eventType,
      payload,
      robots,
      config: automationConfig,
      repo: repoAuth.repo
    });
    if (!actions.length) {
      return respond(202, { skipped: true, reason: 'no automation rule matched' }, { result: 'skipped', message: 'no automation rule matched' });
    }

    const baseMeta = buildTaskMeta(eventType, payload);
    const created: Array<{ id: string; robotId: string }> = [];

    for (const action of actions) {
      const robot = robots.find((r) => r.id === action.robotId);
      const title = baseMeta.title
        ? `${baseMeta.title} · ${robot?.name ?? action.robotId}`
        : robot?.name
          ? `${robot.name} · ${eventType}`
          : undefined;

      // Resolve trigger/robot time windows and skip duplicate queued tasks while waiting. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const schedule = resolveTaskSchedule({
        triggerWindow: action.timeWindow ?? null,
        robotWindow: robot?.timeWindow ?? null,
        ruleId: action.ruleId
      });
      const scheduleActive = schedule ? isTimeWindowActive(schedule.window) : true;
      if (schedule && schedule.source === 'trigger' && !scheduleActive) {
        const alreadyQueued = await taskService.hasQueuedTaskForRule({
          repoId,
          robotId: action.robotId,
          ruleId: schedule.ruleId ?? action.ruleId
        });
        if (alreadyQueued) continue;
      }

      const task = await taskService.createTask(eventType, attachTaskSchedule(payload, schedule), {
        ...baseMeta,
        title,
        repoId,
        repoProvider: 'gitlab',
        robotId: action.robotId,
        promptCustom: action.promptCustom ?? null
      });
      created.push({ id: task.id, robotId: action.robotId });
    }

    if (isInlineWorkerEnabled()) {
      taskRunner.trigger().catch((err) => console.error('[webhook] trigger task runner failed', err));
    }

    return respond(202, { tasks: created }, { result: 'accepted', taskIds: created.map((t) => t.id), message: 'tasks created' });
  } catch (err) {
    console.error('[webhook] gitlab repo failed to create task', err);
    const message = err instanceof Error ? err.message : String(err);
    return respond(500, { error: 'Failed to enqueue task' }, { result: 'error', code: 'INTERNAL_ERROR', message });
  }
};

const buildGithubTaskTitle = (eventType: TaskEventType, payload: any): string | undefined => {
  const repoName: string | undefined = payload?.repository?.full_name;
  const subType = extractSubType(payload);
  switch (eventType) {
    case 'commit': {
      if (subType === 'commented') {
        const body: string | undefined = payload?.comment?.body;
        const snippet = body ? body.replace(/\s+/g, ' ').slice(0, 80) : '';
        return [snippet ? 'CommitComment' : 'Commit', repoName, snippet].filter(Boolean).join(' · ');
      }
      const headCommit =
        payload?.head_commit ||
        (Array.isArray(payload?.commits) && payload.commits.length ? payload.commits[payload.commits.length - 1] : undefined);
      const commitSha: string | undefined =
        (typeof headCommit?.id === 'string' && headCommit.id.trim()) ||
        (typeof headCommit?.sha === 'string' && headCommit.sha.trim()) ||
        (typeof payload?.after === 'string' && payload.after.trim()) ||
        undefined;
      const commitShort = commitSha ? commitSha.slice(0, 8) : '';
      const commitTitle = extractCommitTitle(headCommit);
      const snippet = commitTitle ? commitTitle.replace(/\s+/g, ' ').slice(0, 80) : '';
      const ref = payload?.ref;
      if (repoName || ref) {
        const base = ['Commit', repoName, ref].filter(Boolean).join(' ');
        const extra = [commitShort, snippet].filter(Boolean).join(' · ');
        return extra ? `${base} · ${extra}` : base;
      }
      break;
    }
    case 'commit_review':
    case 'push': {
      const ref = payload?.ref;
      const label = eventType === 'commit_review' ? 'CommitReview' : 'Push';
      if (repoName || ref) return [label, repoName, ref].filter(Boolean).join(' ');
      break;
    }
    case 'merge_request': {
      if (subType === 'commented') {
        const num = payload?.issue?.number;
        const body: string | undefined = payload?.comment?.body;
        const snippet = body ? body.replace(/\s+/g, ' ').slice(0, 80) : '';
        return ['PRComment', repoName, num ? `#${num}` : 'PR', snippet].filter(Boolean).join(' · ');
      }
      const pr = payload?.pull_request;
      const num = pr?.number;
      const title = pr?.title;
      const label = subType === 'updated' ? 'PRUpdated' : 'PR';
      if (num || title) return `${label}${num ? ` #${num}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue': {
      if (subType === 'commented') {
        const issue = payload?.issue;
        const num = issue?.number;
        const body: string | undefined = payload?.comment?.body;
        const snippet = body ? body.replace(/\s+/g, ' ').slice(0, 80) : '';
        return ['IssueComment', repoName, num ? `#${num}` : 'Issue', snippet].filter(Boolean).join(' · ');
      }
      const issue = payload?.issue;
      const num = issue?.number;
      const title = issue?.title;
      const label = subType === 'created' ? 'IssueCreated' : 'Issue';
      if (num || title) return `${label}${num ? ` #${num}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue_created': {
      const issue = payload?.issue;
      const num = issue?.number;
      const title = issue?.title;
      const label = eventType === 'issue_created' ? 'IssueCreated' : 'Issue';
      if (num || title) return `${label}${num ? ` #${num}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue_comment':
    case 'note': {
      const issue = payload?.issue;
      const num = issue?.number;
      const body: string | undefined = payload?.comment?.body;
      const snippet = body ? body.replace(/\s+/g, ' ').slice(0, 80) : '';
      const label = eventType === 'issue_comment' ? 'IssueComment' : 'Comment';
      if (snippet) return [label, repoName, num ? `#${num}` : 'Issue', snippet].filter(Boolean).join(' · ');
      return [label, repoName, num ? `#${num}` : 'Issue'].filter(Boolean).join(' · ');
    }
  }
  return payload?.action ?? payload?.hook?.type;
};

const buildGithubTaskMeta = (eventType: TaskEventType, payload: any): TaskCreateMeta => {
  const meta: TaskCreateMeta = {
    title: buildGithubTaskTitle(eventType, payload),
    repoProvider: 'github'
  };
  const subType = extractSubType(payload);

  switch (eventType) {
    case 'commit':
    case 'commit_review':
    case 'push':
      meta.ref = payload?.ref;
      break;
    case 'merge_request': {
      const pr = payload?.pull_request;
      if (pr && subType !== 'commented') {
        meta.mrId = pr.number;
        meta.ref = pr.head?.ref;
      } else {
        meta.mrId = payload?.issue?.number;
      }
      break;
    }
    case 'issue': {
      meta.issueId = payload?.issue?.number;
      break;
    }
    case 'issue_created':
      meta.issueId = payload?.issue?.number;
      break;
    case 'issue_comment':
    case 'note':
      meta.issueId = payload?.issue?.number;
      break;
  }
  return meta;
};

// Unit-test only: avoid relying on Express routing behavior to indirectly verify metadata extraction logic.
export const __test__buildGithubTaskMeta = buildGithubTaskMeta;

export const handleGithubWebhook = async (req: Request, res: Response, deps: WebhookDeps) => {
  const { taskService, taskRunner, repositoryService, repoRobotService, repoAutomationService, repoWebhookDeliveryService } = deps;
  const repoId = String(req.params.repoId ?? '').trim();
  const eventName = safeString(req.header('x-github-event') ?? '').trim();
  const deliveryId = safeString(req.header('x-github-delivery') ?? '').trim();
  const basePayload = req.body;

  let canRecord = false;
  const respond = async (
    httpStatus: number,
    body: any,
    meta: { result: 'accepted' | 'skipped' | 'rejected' | 'error'; code?: string; message?: string; taskIds?: string[] }
  ) => {
    if (canRecord) {
      await recordWebhookDeliveryBestEffort(repoWebhookDeliveryService, {
        repoId,
        provider: 'github',
        eventName,
        deliveryId,
        payload: basePayload,
        httpStatus,
        result: meta.result,
        code: meta.code,
        message: meta.message,
        taskIds: meta.taskIds,
        response: body
      });
    }
    return res.status(httpStatus).json(body);
  };

  try {
    const repoAuth = await repositoryService.getByIdWithSecret(repoId);
    if (!repoAuth) return res.status(404).json({ error: 'Repo not found' });
    canRecord = true;

    // Do not accept events for archived repos to keep the Archive area stable. qnp1mtxhzikhbi0xspbc
    if (repoAuth.repo.archivedAt) {
      return respond(202, { skipped: true, reason: 'repo archived' }, { result: 'skipped', message: 'repo archived' });
    }
    if (!repoAuth.repo.enabled) {
      return respond(202, { skipped: true, reason: 'repo disabled' }, { result: 'skipped', message: 'repo disabled' });
    }
    if (repoAuth.repo.provider !== 'github') {
      return respond(400, { error: 'Repo provider mismatch' }, { result: 'rejected', message: 'Repo provider mismatch' });
    }

    // Webhook ingress guard: block GitLab-delivered requests hitting the GitHub endpoint with a clear provider hint. (Change record: 2026-01-15)
    const providerMismatch = detectWebhookProviderMismatch('github', req, eventName);
    if (providerMismatch) {
      return respond(
        400,
        {
          error: 'Webhook provider mismatch',
          code: 'WEBHOOK_PROVIDER_MISMATCH',
          expectedProvider: providerMismatch.expectedProvider,
          detectedProvider: providerMismatch.detectedProvider,
          hint: providerMismatch.hint
        },
        { result: 'rejected', code: 'WEBHOOK_PROVIDER_MISMATCH', message: providerMismatch.message }
      );
    }

    const verify = verifyGithubSecret(req, repoAuth.webhookSecret);
    if (!verify.ok) {
      return respond(401, { error: 'Unauthorized', reason: verify.reason }, { result: 'rejected', code: 'UNAUTHORIZED', message: verify.reason });
    }

    const nameBinding = validateRepoWebhookNameBinding('github', repoAuth.repo, req.body);
    if (!nameBinding.ok) {
      const code = safeString(nameBinding.body?.code ?? '').trim() || undefined;
      const message = safeString(nameBinding.body?.error ?? '').trim() || safeString(nameBinding.body?.reason ?? '').trim() || undefined;
      return respond(nameBinding.status, nameBinding.body, { result: 'rejected', code, message });
    }

    const binding = validateRepoWebhookBinding('github', repoAuth.repo, req.body);
    if (!binding.ok) {
      const code = safeString(binding.body?.code ?? '').trim() || undefined;
      const message = safeString(binding.body?.error ?? '').trim() || safeString(binding.body?.reason ?? '').trim() || undefined;
      return respond(binding.status, binding.body, { result: 'rejected', code, message });
    }

    // Before marking verified, ensure repo identity is persisted (bind-on-first-delivery).
    const patch = buildRepoHydrationPatch('github', repoAuth.repo, req.body);
    if (Object.keys(patch).length) {
      try {
        await repositoryService.updateRepository(repoId, patch);
      } catch (err) {
        const mustBind = Boolean(patch.externalId || patch.apiBaseUrl);
        if (mustBind) {
          console.error('[webhook] hydrate repo identity failed', err);
          return respond(
            409,
            { error: 'Failed to bind webhook to repository identity', code: 'WEBHOOK_BIND_FAILED' },
            { result: 'rejected', code: 'WEBHOOK_BIND_FAILED', message: 'Failed to bind webhook to repository identity' }
          );
        }
        console.warn('[webhook] hydrate repo config failed (ignored)', err);
      }
    }

    await repositoryService.markWebhookVerified(repoId);

    const robots = (await repoRobotService.listByRepo(repoId)).filter((r) => r.enabled);
    if (!robots.length) {
      return respond(202, { skipped: true, reason: 'no enabled robot configured' }, { result: 'skipped', message: 'no enabled robot configured' });
    }

    const mapped = mapGithubAutomationEvent(eventName, req.body);
    if (!mapped) {
      return respond(202, { skipped: true, reason: 'event not supported' }, { result: 'skipped', message: 'event not supported' });
    }
    const eventType = mapped.eventType;
    const payload = { ...req.body, __subType: mapped.subType };

    const { allowed, reason } = canCreateGithubAutomationTask(eventType, payload, robots);
    console.log('[webhook] github repo', repoId, 'event', eventType, 'allowed:', allowed, reason ? `reason: ${reason}` : '');
    if (!allowed) {
      return respond(202, { skipped: true, reason }, { result: 'skipped', message: reason });
    }

    const automationConfig = await repoAutomationService.getConfig(repoId);
    const actions = resolveAutomationActions({
      eventType,
      payload,
      robots,
      config: automationConfig,
      repo: repoAuth.repo
    });
    if (!actions.length) {
      return respond(202, { skipped: true, reason: 'no automation rule matched' }, { result: 'skipped', message: 'no automation rule matched' });
    }

    const baseMeta = buildGithubTaskMeta(eventType, payload);
    const created: Array<{ id: string; robotId: string }> = [];

    for (const action of actions) {
      const robot = robots.find((r) => r.id === action.robotId);
      const title = baseMeta.title
        ? `${baseMeta.title} · ${robot?.name ?? action.robotId}`
        : robot?.name
          ? `${robot.name} · ${eventType}`
          : undefined;

      // Resolve trigger/robot time windows and skip duplicate queued tasks while waiting. docs/en/developer/plans/timewindowtask20260126/task_plan.md timewindowtask20260126
      const schedule = resolveTaskSchedule({
        triggerWindow: action.timeWindow ?? null,
        robotWindow: robot?.timeWindow ?? null,
        ruleId: action.ruleId
      });
      const scheduleActive = schedule ? isTimeWindowActive(schedule.window) : true;
      if (schedule && schedule.source === 'trigger' && !scheduleActive) {
        const alreadyQueued = await taskService.hasQueuedTaskForRule({
          repoId,
          robotId: action.robotId,
          ruleId: schedule.ruleId ?? action.ruleId
        });
        if (alreadyQueued) continue;
      }

      const task = await taskService.createTask(eventType, attachTaskSchedule(payload, schedule), {
        ...baseMeta,
        title,
        repoId,
        repoProvider: 'github',
        robotId: action.robotId,
        promptCustom: action.promptCustom ?? null
      });
      created.push({ id: task.id, robotId: action.robotId });
    }

    if (isInlineWorkerEnabled()) {
      taskRunner.trigger().catch((err) => console.error('[webhook] trigger task runner failed', err));
    }
    return respond(202, { tasks: created }, { result: 'accepted', taskIds: created.map((t) => t.id), message: 'tasks created' });
  } catch (err) {
    console.error('[webhook] github repo failed to create task', err);
    const message = err instanceof Error ? err.message : String(err);
    return respond(500, { error: 'Failed to enqueue task' }, { result: 'error', code: 'INTERNAL_ERROR', message });
  }
};

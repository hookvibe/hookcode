import type { Task } from '../types/task';
import type { RepoProvider } from '../types/repository';
import type { GitlabService } from '../services/gitlabService';
import type { GithubService } from '../services/githubService';
// Reuse shared payload parsers to keep provider targeting logic consistent. 24yz61mdik7tqdgaa152
import { getGithubRepoSlugFromPayload, getGitlabProjectIdFromPayload } from '../utils/repoPayload';
// Reuse the shared task URL builder so provider comments can link back to the HookCode console. docs/en/developer/plans/taskdetailbacklink20260122k4p8/task_plan.md taskdetailbacklink20260122k4p8
import { getTaskConsoleUrl } from '../utils/taskConsoleUrl';

/**
 * Post task results back to code hosting platforms (GitLab/GitHub):
 * - Called by `backend/src/agent/agent.ts` when a task finishes (or during failure fallback).
 * - Chooses the appropriate API based on the task target (Issue/Commit, etc.).
 */

const getGithubCommitSha = (payload: any): string | null => {
  const sha = String(payload?.after ?? payload?.head_commit?.id ?? '').trim();
  return sha ? sha : null;
};

export interface PostToProviderInput {
  provider: RepoProvider;
  task: Task;
  payload: any;
  body: string;
  gitlab?: GitlabService;
  github?: GithubService;
}

export interface PostToProviderResult {
  /**
   * Final provider-side "comment/message" URL (if derivable/available).
   */
  url?: string;
}

const normalizeWebUrl = (raw: unknown): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\.git$/, '').replace(/\/$/, '');
};

const getGitlabProjectWebUrl = (payload: any): string | undefined =>
  normalizeWebUrl(
    payload?.project?.web_url ||
      payload?.project?.homepage ||
      payload?.project?.http_url ||
      payload?.project?.git_http_url ||
      payload?.project?.http_url_to_repo
  );

const isCommentTriggeredTask = (task: Task, payload: any): boolean => {
  const subType = typeof payload?.__subType === 'string' ? payload.__subType.trim() : '';
  if (subType === 'commented') return true;
  return task.eventType === 'issue_comment' || task.eventType === 'note';
};

const buildTriggerCommentWebUrl = (provider: RepoProvider, task: Task, payload: any): string | undefined => {
  if (!isCommentTriggeredTask(task, payload)) return undefined;

  if (provider === 'github') {
    return normalizeWebUrl(payload?.comment?.html_url);
  }

  if (provider === 'gitlab') {
    const projectWebUrl = getGitlabProjectWebUrl(payload);
    const noteIdRaw = payload?.object_attributes?.id;
    const noteId = typeof noteIdRaw === 'number' || typeof noteIdRaw === 'string' ? String(noteIdRaw).trim() : '';
    if (!projectWebUrl || !noteId) return undefined;

    const noteableType = typeof payload?.object_attributes?.noteable_type === 'string' ? payload.object_attributes.noteable_type : '';
    if (noteableType === 'MergeRequest') {
      const mrIid = payload?.merge_request?.iid ?? payload?.object_attributes?.noteable_id;
      if (!mrIid) return undefined;
      return `${projectWebUrl}/-/merge_requests/${mrIid}#note_${noteId}`;
    }
    if (noteableType === 'Issue') {
      const issueIid = payload?.issue?.iid ?? payload?.issue?.number ?? payload?.object_attributes?.noteable_id;
      if (!issueIid) return undefined;
      return `${projectWebUrl}/-/issues/${issueIid}#note_${noteId}`;
    }
    if (noteableType === 'Commit') {
      const commitSha = typeof payload?.commit?.id === 'string' ? payload.commit.id : typeof payload?.after === 'string' ? payload.after : undefined;
      if (!commitSha?.trim()) return undefined;
      return `${projectWebUrl}/-/commit/${commitSha.trim()}#note_${noteId}`;
    }

    const raw = normalizeWebUrl(payload?.object_attributes?.url);
    if (raw && !raw.includes('/api/')) return raw;
  }

  return undefined;
};

const prependTriggerBacklinkIfNeeded = (input: { provider: RepoProvider; task: Task; payload: any; body: string }): string => {
  const url = buildTriggerCommentWebUrl(input.provider, input.task, input.payload);
  if (!url) return input.body;
  // Prepend a backlink to the triggering webhook comment for better traceability. docs/en/developer/plans/commentreply20260122r9k2/task_plan.md commentreply20260122r9k2
  return `> Triggered by: ${url}\n\n${input.body}`;
};

const appendHookCodeTaskLink = (taskId: string, body: string): string => {
  const consoleUrl = getTaskConsoleUrl(taskId);
  const label = '`HookCode · Task`';
  const footer = `[${label}](${consoleUrl})`;
  // Append a compact badge-like task-detail footer link for quick navigation back to the console. docs/en/developer/plans/taskdetailbacklink20260122k4p8/task_plan.md taskdetailbacklink20260122k4p8
  if (body.includes(footer)) return body;
  return `${body}\n\n${footer}`;
};

export const postToProvider = async (input: PostToProviderInput): Promise<PostToProviderResult> => {
  // Business context (Chat/manual trigger):
  // - Console "chat" tasks do not map to a provider-side comment target.
  // - Change record: allow callers to explicitly disable provider posting via `eventType=chat` or `__skipProviderPost`.
  if (input.task.eventType === 'chat' || Boolean((input.payload as any)?.__skipProviderPost)) {
    return {};
  }

  const body = appendHookCodeTaskLink(input.task.id, prependTriggerBacklinkIfNeeded(input));

  if (input.provider === 'gitlab') {
    if (!input.gitlab) throw new Error('gitlab client not configured');

    const subType = typeof input.payload?.__subType === 'string' ? input.payload.__subType.trim() : '';
    const toFiniteNumber = (value: unknown): number | null => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
      return null;
    };

    const projectId = getGitlabProjectIdFromPayload(input.task, input.payload);

    // Fallback: some legacy/abnormal tasks may have mistakenly written note.id into task.issueId/task.mrId;
    // for the "commented" subtype, issue/mr i(i)d from the payload is more reliable.
    const payloadMrIid = toFiniteNumber(input.payload?.merge_request?.iid);
    const isIssueNoteHook = input.payload?.object_attributes?.noteable_type === 'Issue';
    const payloadIssueIid = toFiniteNumber(
      isIssueNoteHook ? input.payload?.issue?.iid : input.payload?.issue?.iid ?? input.payload?.object_attributes?.iid
    );
    const payloadIssueId = toFiniteNumber(
      isIssueNoteHook
        ? input.payload?.issue?.id ?? input.payload?.object_attributes?.noteable_id
        : input.payload?.issue?.id ?? input.payload?.object_attributes?.id
    );
    const taskMrId = toFiniteNumber(input.task.mrId);
    const taskIssueId = toFiniteNumber(input.task.issueId);
    const mrId = subType === 'commented' ? payloadMrIid ?? taskMrId ?? undefined : taskMrId ?? undefined;
    let issueIid: number | undefined = payloadIssueIid ?? taskIssueId ?? undefined;
    let resolvedProjectId: string | number | null = projectId;

    // If task.issueId is actually issue.id (global id), do not treat it as iid.
    if (!payloadIssueIid && payloadIssueId && taskIssueId && payloadIssueId === taskIssueId) {
      issueIid = undefined;
    }

    if (!issueIid && payloadIssueId) {
      // Some webhooks/tasks only carry issue.id (global id); fetch once to get iid.
      try {
        const raw = await input.gitlab.getIssueById(payloadIssueId);
        if (resolvedProjectId && raw.project_id && String(resolvedProjectId) !== String(raw.project_id)) {
          throw new Error(
            `gitlab issue project mismatch: task.projectId=${resolvedProjectId} issue.project_id=${raw.project_id}`
          );
        }
        if (!resolvedProjectId) resolvedProjectId = raw.project_id ?? null;
        issueIid = raw.iid;
      } catch (_err) {
        // ignore: downstream will error/skip per the original logic.
      }
    }

    const rawDiscussionId =
      input.payload?.object_attributes?.discussion_id ?? input.payload?.discussion?.id;
    const discussionId = rawDiscussionId ? String(rawDiscussionId).trim() : undefined;

    const projectWebUrl = getGitlabProjectWebUrl(input.payload);

    if (mrId) {
      if (!resolvedProjectId) throw new Error('missing gitlab project id');
      if (discussionId) {
        let note: { id: number } | undefined;
        try {
          note = await input.gitlab.addMergeRequestDiscussionNote(resolvedProjectId, mrId, discussionId, body);
        } catch (err: any) {
          // The discussion reply endpoint may occasionally return 404 (discussion missing/not visible);
          // fall back to a normal comment to avoid failing the whole post.
          try {
            note = await input.gitlab.addMergeRequestNote(resolvedProjectId, mrId, body);
          } catch (fallbackErr: any) {
            throw new Error(
              `gitlab discussion reply failed and fallback also failed: ${err?.message || err}; fallback: ${
                fallbackErr?.message || fallbackErr
              }`
            );
          }
        }
        const url = projectWebUrl && note?.id ? `${projectWebUrl}/-/merge_requests/${mrId}#note_${note.id}` : undefined;
        return { url };
      } else {
        if (!resolvedProjectId) throw new Error('missing gitlab project id');
        const note = await input.gitlab.addMergeRequestNote(resolvedProjectId, mrId, body);
        const url = projectWebUrl && note?.id ? `${projectWebUrl}/-/merge_requests/${mrId}#note_${note.id}` : undefined;
        return { url };
      }
    }

    if (issueIid) {
      if (!resolvedProjectId) throw new Error('missing gitlab project id');
      if (discussionId) {
        let note: { id: number } | undefined;
        try {
          note = await input.gitlab.addIssueDiscussionNote(resolvedProjectId, issueIid, discussionId, body);
        } catch (err: any) {
          // Same as MR: if discussion reply fails, fall back to a normal comment.
          try {
            note = await input.gitlab.addIssueNote(resolvedProjectId, issueIid, body);
          } catch (fallbackErr: any) {
            throw new Error(
              `gitlab discussion reply failed and fallback also failed: ${err?.message || err}; fallback: ${
                fallbackErr?.message || fallbackErr
              }`
            );
          }
        }
        const url = projectWebUrl && note?.id ? `${projectWebUrl}/-/issues/${issueIid}#note_${note.id}` : undefined;
        return { url };
      } else {
        const note = await input.gitlab.addIssueNote(resolvedProjectId, issueIid, body);
        const url = projectWebUrl && note?.id ? `${projectWebUrl}/-/issues/${issueIid}#note_${note.id}` : undefined;
        return { url };
      }
    }

    if (!resolvedProjectId) throw new Error('missing gitlab project id');
    const commitSha: string | undefined = input.payload?.checkout_sha ?? input.payload?.after;
    if (commitSha) {
      const note = await input.gitlab.addCommitComment(resolvedProjectId, commitSha, body);
      const url = projectWebUrl && note?.id ? `${projectWebUrl}/-/commit/${commitSha}#note_${note.id}` : undefined;
      return { url };
    }

    throw new Error('no gitlab target to post');
  }

  if (input.provider === 'github') {
    if (!input.github) throw new Error('github client not configured');
    const slug = getGithubRepoSlugFromPayload(input.payload);
    if (!slug) throw new Error('missing github repo slug');

    const issueNumber = input.task.issueId ?? input.task.mrId;
    if (issueNumber) {
      const comment = await input.github.addIssueComment(slug.owner, slug.repo, issueNumber, body);
      return { url: normalizeWebUrl(comment?.html_url) };
    }

    const sha = getGithubCommitSha(input.payload);
    if (sha) {
      const comment = await input.github.addCommitComment(slug.owner, slug.repo, sha, body);
      return { url: normalizeWebUrl(comment?.html_url) };
    }

    throw new Error('no github target to post');
  }

  throw new Error(`unsupported provider: ${input.provider}`);
};

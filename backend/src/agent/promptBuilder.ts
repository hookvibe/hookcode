import { Task } from '../types/task';
import type { Repository } from '../types/repository';
import type { RepoRobot } from '../types/repoRobot';
import { getBotUsernames } from './robots';
import { renderTemplate } from './template';
import type { GitlabCommitComment, GitlabIssue, GitlabNote } from '../services/gitlabService';
import type { GitlabService } from '../services/gitlabService';
import type { GithubCommitComment, GithubIssue, GithubIssueComment, GithubService } from '../services/githubService';
// Reuse shared payload parsers to reduce drift between prompt building and provider posting. 24yz61mdik7tqdgaa152
import { getGithubRepoSlugFromPayload, getGitlabProjectIdFromPayload } from '../utils/repoPayload';

/**
 * Prompt builder (multi-repo):
 * - Called by `backend/src/agent/agent.ts`: converts "task + Webhook payload + repo config" into natural-language instructions executable by Codex.
 * - Prompt templates come from the robot (DB field `promptDefault`), and automation patch/override can generate task.promptCustom.
 */

export interface PromptContext {
  robot: RepoRobot;
  body: string;
}

export interface BuildPromptInput {
  task: Task;
  payload: any;
  repo: Repository | null;
  checkout?: { branch: string; source: string };
  robot: RepoRobot;
  robotsInRepo: RepoRobot[];
  gitlab?: GitlabService;
  github?: GithubService;
}

interface NormalizedIssue {
  id?: number;
  number: number;
  title: string;
  body?: string;
  url?: string;
}

interface NormalizedNote {
  id: string;
  body: string;
  author?: string;
  discussionId?: string;
}

interface NormalizedMergeRequest {
  id?: number;
  number?: number;
  title: string;
  body?: string;
  url?: string;
  sourceBranch?: string;
  targetBranch?: string;
}

interface NotesContext {
  currentThread: NormalizedNote[];
  history: NormalizedNote[];
  currentText: string;
  historyText: string;
}

const formatRef = (ref?: string) => (ref ? ref.replace(/^refs\/heads\//, '') : ref);

const formatNotes = (notes: NormalizedNote[]) =>
  notes
    .map((n) => `${n.author ?? 'unknown'}: ${n.body}`)
    .join('\n');

const normalizeGitlabIssue = (issue: GitlabIssue): NormalizedIssue => ({
  id: issue.id,
  number: issue.iid,
  title: issue.title,
  body: issue.description ?? undefined,
  url: issue.web_url ?? undefined
});

const normalizeGitlabNotes = (notes: GitlabNote[]): NormalizedNote[] =>
  notes.map((n) => ({
    id: String(n.id),
    body: n.body,
    author: n.author?.username ?? undefined,
    discussionId: n.discussion_id ?? undefined
  }));

const normalizeGithubIssue = (issue: GithubIssue): NormalizedIssue => ({
  id: issue.id,
  number: issue.number,
  title: issue.title,
  body: issue.body ?? undefined,
  url: issue.html_url ?? undefined
});

const normalizeGithubComments = (comments: GithubIssueComment[]): NormalizedNote[] =>
  comments.map((c) => ({
    id: String(c.id),
    body: c.body ?? '',
    author: c.user?.login ?? undefined
  }));

const normalizeGithubCommitComments = (comments: GithubCommitComment[]): NormalizedNote[] =>
  comments.map((c) => ({
    id: String(c.id),
    body: c.body ?? '',
    author: c.user?.login ?? undefined
  }));

const normalizeGitlabCommitComments = (comments: GitlabCommitComment[]): NormalizedNote[] =>
  comments.map((c) => ({
    id: String(c.id),
    body: c.note ?? '',
    author: c.author?.username ?? undefined
  }));

const normalizeGitlabMergeRequestFromPayload = (payload: any): NormalizedMergeRequest | null => {
  const subType = typeof payload?.__subType === 'string' ? payload.__subType.trim() : '';
  const mr =
    subType === 'commented'
      ? payload?.merge_request ?? payload?.pull_request ?? payload?.object_attributes?.merge_request
      : payload?.object_attributes ?? payload?.merge_request ?? payload?.pull_request;

  const number = typeof mr?.iid === 'number' ? mr.iid : undefined;
  const title = typeof mr?.title === 'string' ? mr.title : '';
  if (!number && !title) return null;

  return {
    id: typeof mr?.id === 'number' ? mr.id : undefined,
    number,
    title,
    body: typeof mr?.description === 'string' ? mr.description : undefined,
    url: typeof mr?.web_url === 'string' ? mr.web_url : undefined,
    sourceBranch: typeof mr?.source_branch === 'string' ? mr.source_branch : undefined,
    targetBranch: typeof mr?.target_branch === 'string' ? mr.target_branch : undefined
  };
};

const normalizeGithubMergeRequestFromPayload = (payload: any): NormalizedMergeRequest | null => {
  const pr = payload?.pull_request ?? payload?.issue;
  const number = typeof pr?.number === 'number' ? pr.number : undefined;
  const title = typeof pr?.title === 'string' ? pr.title : '';
  if (!number && !title) return null;

  return {
    id: typeof pr?.id === 'number' ? pr.id : undefined,
    number,
    title,
    body: typeof pr?.body === 'string' ? pr.body : undefined,
    url: typeof pr?.html_url === 'string' ? pr.html_url : undefined,
    sourceBranch: typeof pr?.head?.ref === 'string' ? pr.head.ref : undefined,
    targetBranch: typeof pr?.base?.ref === 'string' ? pr.base.ref : undefined
  };
};

const buildNotesContext = (
  provider: string,
  payload: any,
  notes: NormalizedNote[],
  botUsernames: string[]
): NotesContext => {
  const filtered = notes.filter((n) => !botUsernames.includes(String(n.author ?? '').toLowerCase()));

  const discussionId: string | undefined =
    provider === 'gitlab' ? payload?.object_attributes?.discussion_id ?? payload?.discussion?.id : undefined;
  const currentNoteId: string | undefined =
    provider === 'gitlab'
      ? payload?.object_attributes?.id
        ? String(payload.object_attributes.id)
        : undefined
      : payload?.comment?.id
        ? String(payload.comment.id)
        : undefined;

  const currentThread = filtered.filter((n) => n.id === currentNoteId || (discussionId && n.discussionId === discussionId));
  const history = filtered.filter((n) => !currentThread.includes(n));

  const currentText = currentThread.length ? formatNotes(currentThread) : '';
  const historyText = history.length ? formatNotes(history) : '';

  return {
    currentThread,
    history,
    currentText,
    historyText
  };
};

const getGitlabProjectId = (task: Task, payload: any): string | number | null =>
  getGitlabProjectIdFromPayload(task, payload);

const getGithubRepoSlug = (payload: any): { owner: string; repo: string } | null =>
  getGithubRepoSlugFromPayload(payload);

const extractCommentContext = (input: BuildPromptInput): { body: string; author?: string } | undefined => {
  const provider = input.repo?.provider ?? input.task.repoProvider ?? 'gitlab';
  if (provider === 'gitlab') {
    const body = typeof input.payload?.object_attributes?.note === 'string' ? input.payload.object_attributes.note : '';
    if (!body.trim()) return undefined;
    const author: string | undefined = input.payload?.user?.username || input.payload?.user?.name;
    return { body, author };
  }
  if (provider === 'github') {
    const body = typeof input.payload?.comment?.body === 'string' ? input.payload.comment.body : '';
    if (!body.trim()) return undefined;
    const author: string | undefined = input.payload?.comment?.user?.login ?? input.payload?.sender?.login;
    return { body, author };
  }
  return undefined;
};

const buildSingleCommentContext = (
  comment: { body: string; author?: string } | undefined,
  botUsernames: string[]
): NotesContext | undefined => {
  if (!comment?.body?.trim()) return undefined;
  const authorLower = String(comment.author ?? '').toLowerCase().trim();
  if (authorLower && botUsernames.includes(authorLower)) return undefined;
  const note: NormalizedNote = { id: 'current', body: comment.body, author: comment.author };
  return { currentThread: [note], history: [], currentText: formatNotes([note]), historyText: '' };
};

const extractCommitShaFromCommitsArray = (payload: any): string | null => {
  const commits = Array.isArray(payload?.commits) ? payload.commits : [];
  if (!commits.length) return null;
  const last = commits[commits.length - 1];
  const candidates = [last?.id, last?.sha, commits[0]?.id, commits[0]?.sha];
  for (const value of candidates) {
    const sha = typeof value === 'string' ? value.trim() : '';
    if (sha) return sha;
  }
  return null;
};

const getGitlabCommitShaFromPayload = (payload: any): string | null => {
  const shaCandidates = [
    payload?.checkout_sha,
    payload?.after,
    payload?.object_attributes?.commit_id,
    payload?.commit?.id,
    payload?.commit?.sha
  ];
  for (const value of shaCandidates) {
    const sha = typeof value === 'string' ? value.trim() : '';
    if (sha) return sha;
  }
  return extractCommitShaFromCommitsArray(payload);
};

const getGithubCommitShaFromPayload = (payload: any): string | null => {
  const shaCandidates = [payload?.comment?.commit_id, payload?.after, payload?.head_commit?.id];
  for (const value of shaCandidates) {
    const sha = typeof value === 'string' ? value.trim() : '';
    if (sha) return sha;
  }
  return extractCommitShaFromCommitsArray(payload);
};

const extractCommitMessageFromPayload = (provider: string, payload: any): string => {
  if (provider === 'github') {
    const head = typeof payload?.head_commit?.message === 'string' ? payload.head_commit.message : '';
    if (head.trim()) return head;

    const commits = Array.isArray(payload?.commits) ? payload.commits : [];
    const last = commits.length ? commits[commits.length - 1] : undefined;
    const message = typeof last?.message === 'string' ? last.message : '';
    if (message.trim()) return message;

    const title = typeof last?.title === 'string' ? last.title : '';
    return title.trim() ? title : '';
  }

  const commits = Array.isArray(payload?.commits) ? payload.commits : [];
  const last = commits.length ? commits[commits.length - 1] : undefined;
  const lastMessage = typeof last?.message === 'string' ? last.message : '';
  if (lastMessage.trim()) return lastMessage;

  const lastTitle = typeof last?.title === 'string' ? last.title : '';
  if (lastTitle.trim()) return lastTitle;

  const commitMessage = typeof payload?.commit?.message === 'string' ? payload.commit.message : '';
  if (commitMessage.trim()) return commitMessage;

  const commitTitle = typeof payload?.commit?.title === 'string' ? payload.commit.title : '';
  if (commitTitle.trim()) return commitTitle;

  return '';
};

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const pickFirstNonEmptyText = (...values: Array<string | undefined | null>): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
};

const resolveRepoDefaultBranch = (repo: Repository | null): string => {
  const branches = Array.isArray(repo?.branches) ? repo!.branches! : [];
  const explicit = branches.find((b) => b?.isDefault && safeTrim(b?.name));
  if (explicit) return safeTrim(explicit.name);
  if (branches.length === 1 && safeTrim(branches[0]?.name)) return safeTrim(branches[0].name);
  return '';
};

const buildBranchesText = (repo: Repository | null): string => {
  const branches = Array.isArray(repo?.branches) ? repo!.branches! : [];
  return branches
    .map((b) => {
      const name = safeTrim(b?.name);
      if (!name) return '';
      const note = safeTrim(b?.note);
      return note ? `${name}（${note}）` : name;
    })
    .filter(Boolean)
    .join(', ');
};

const buildTemplateContext = (
  input: BuildPromptInput,
  opts?: {
    issue?: NormalizedIssue | null;
    commentContext?: NotesContext;
    commit?: { sha?: string; message?: string };
    issueFetchFailed?: boolean;
  }
) => {
  const provider = input.repo?.provider ?? input.task.repoProvider ?? 'gitlab';
  const repoDefaultBranch = resolveRepoDefaultBranch(input.repo);

  const rawRef: string | undefined = input.task.ref ?? input.payload?.ref;
  const branch = formatRef(rawRef) ?? rawRef ?? '';

  const comment = extractCommentContext(input);
  const commentContext = opts?.commentContext;
  const issue = opts?.issue ?? null;
  const issueNumber = issue?.number ?? input.task.issueId;

  const mergeRequest =
    input.task.eventType === 'merge_request'
      ? provider === 'gitlab'
        ? normalizeGitlabMergeRequestFromPayload(input.payload)
        : normalizeGithubMergeRequestFromPayload(input.payload)
      : null;

  const mrNumber = mergeRequest?.number ?? input.task.mrId;
  const commitSha = provider === 'gitlab' ? getGitlabCommitShaFromPayload(input.payload) : getGithubCommitShaFromPayload(input.payload);
  const commitMessage = extractCommitMessageFromPayload(provider, input.payload);

  return {
    repo: {
      id: input.repo?.id ?? '',
      provider,
      name: input.repo?.name ?? '',
      externalId: input.repo?.externalId ?? '',
      defaultBranch: repoDefaultBranch,
      branchesText: buildBranchesText(input.repo)
    },
    robot: {
      id: input.robot.id,
      name: input.robot.name,
      permission: input.robot.permission,
      language: input.robot.language ?? ''
    },
    task: {
      id: input.task.id,
      eventType: input.task.eventType,
      title: input.task.title ?? '',
      ref: input.task.ref ?? '',
      issueId: input.task.issueId ?? '',
      mrId: input.task.mrId ?? ''
    },
    commit:
      input.task.eventType === 'commit' || input.task.eventType === 'commit_review' || input.task.eventType === 'push'
        ? {
            branch,
            sha: pickFirstNonEmptyText(opts?.commit?.sha, commitSha),
            message: pickFirstNonEmptyText(opts?.commit?.message, commitMessage)
          }
        : undefined,
    issue: input.task.eventType === 'issue' || input.task.eventType === 'issue_created' || input.task.eventType === 'issue_comment'
      ? input.task.issueId
      ? {
          id: issue?.id ?? '',
          number: typeof issueNumber === 'number' ? issueNumber : '',
          title: issue?.title ?? '',
          url: issue?.url ?? '',
          body: issue?.body ?? '',
        }
      : undefined
      : undefined,
    mergeRequest:
      input.task.eventType === 'merge_request'
        ? {
            id: mergeRequest?.id ?? '',
            number: typeof mrNumber === 'number' ? mrNumber : '',
            title: mergeRequest?.title ?? '',
            url: mergeRequest?.url ?? '',
            body: mergeRequest?.body ?? '',
            sourceBranch: mergeRequest?.sourceBranch ?? '',
            targetBranch: mergeRequest?.targetBranch ?? ''
          }
        : undefined,
    comment: {
      body: comment?.body ?? '',
      author: comment?.author,
      context: commentContext
        ? {
            current: commentContext.currentText,
            history: commentContext.historyText
          }
        : undefined
    }
  };
};

export const buildPrompt = async (input: BuildPromptInput): Promise<PromptContext> => {
  const provider = input.repo?.provider ?? input.task.repoProvider ?? 'gitlab';
  const robotsForFiltering = input.robotsInRepo.length ? input.robotsInRepo : [input.robot];
  const botUsernames = getBotUsernames(robotsForFiltering);

  const custom = input.task.promptCustom?.trim();
  const subType = typeof input.payload?.__subType === 'string' ? input.payload.__subType.trim() : '';
  const isCommented = subType === 'commented';

  let issue: NormalizedIssue | null = null;
  let notes: NormalizedNote[] = [];
  let issueFetchFailed = false;
  if (input.task.issueId) {
    try {
      if (provider === 'gitlab') {
        if (!input.gitlab) throw new Error('gitlab client not configured');
        const projectId = getGitlabProjectId(input.task, input.payload);
        const taskIssueId = input.task.issueId;

        const toFiniteNumber = (value: unknown): number | undefined => {
          if (typeof value === 'number' && Number.isFinite(value)) return value;
          if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
          return undefined;
        };

        const noteableType = input.payload?.object_attributes?.noteable_type;
        const hasNoteBody = typeof input.payload?.object_attributes?.note === 'string';
        const isIssueNoteHook = noteableType === 'Issue' || (hasNoteBody && Boolean(input.payload?.issue));
        const payloadIssueIid = isIssueNoteHook
          ? toFiniteNumber(input.payload?.issue?.iid)
          : toFiniteNumber(input.payload?.object_attributes?.iid ?? input.payload?.issue?.iid);
        const payloadIssueId = isIssueNoteHook
          ? toFiniteNumber(input.payload?.issue?.id ?? input.payload?.object_attributes?.noteable_id)
          : hasNoteBody
            ? toFiniteNumber(input.payload?.object_attributes?.noteable_id ?? input.payload?.issue?.id)
            : toFiniteNumber(input.payload?.object_attributes?.id ?? input.payload?.issue?.id);

        let rawIssue: GitlabIssue | null = null;
        let rawNotes: GitlabNote[] = [];

        if (projectId) {
          try {
            const issueIid = payloadIssueIid ?? taskIssueId;
            rawIssue = await input.gitlab.getIssue(projectId, issueIid);
            rawNotes = await input.gitlab.listIssueNotes(projectId, issueIid);
          } catch (_err) {
            // Webhook/task may only contain issue.id (global id); call `/issues/:id` to resolve iid.
            if (!payloadIssueId) throw _err;
            const byId = await input.gitlab.getIssueById(payloadIssueId);
            rawIssue = byId;
            const resolvedProjectId = byId.project_id ?? projectId;
            if (resolvedProjectId !== undefined && resolvedProjectId !== null && String(resolvedProjectId).trim()) {
              rawNotes = await input.gitlab.listIssueNotes(resolvedProjectId, byId.iid);
            }
          }
        } else {
          // Without projectId, we can only use the global issue.id.
          const issueId = payloadIssueId ?? toFiniteNumber(taskIssueId);
          if (!issueId) throw new Error('missing gitlab issue id');
          const byId = await input.gitlab.getIssueById(issueId);
          rawIssue = byId;
          const resolvedProjectId = byId.project_id;
          if (resolvedProjectId) {
            rawNotes = await input.gitlab.listIssueNotes(resolvedProjectId, byId.iid);
          }
        }

        issue = rawIssue ? normalizeGitlabIssue(rawIssue) : null;
        notes = rawNotes.length ? normalizeGitlabNotes(rawNotes) : [];
      } else if (provider === 'github') {
        if (!input.github) throw new Error('github client not configured');
        const slug = getGithubRepoSlug(input.payload);
        if (!slug) throw new Error('missing github repo slug');
        const rawIssue = await input.github.getIssue(slug.owner, slug.repo, input.task.issueId);
        const rawComments = await input.github.listIssueComments(slug.owner, slug.repo, input.task.issueId);
        issue = normalizeGithubIssue(rawIssue);
        notes = normalizeGithubComments(rawComments);
      }
    } catch (_err) {
      issueFetchFailed = true;
    }
  }

  const comment = extractCommentContext(input);

  let commentNotes: NormalizedNote[] = [];
  if (isCommented) {
    try {
      if (provider === 'gitlab') {
        if (!input.gitlab) throw new Error('gitlab client not configured');
        const projectId = getGitlabProjectId(input.task, input.payload);

        if (input.task.eventType === 'issue') {
          commentNotes = notes;
        } else if (input.task.eventType === 'merge_request') {
          const mrIid = typeof input.payload?.merge_request?.iid === 'number' ? input.payload.merge_request.iid : input.task.mrId;
          if (projectId && typeof mrIid === 'number') {
            const rawNotes = await input.gitlab.listMergeRequestNotes(projectId, mrIid);
            commentNotes = rawNotes.length ? normalizeGitlabNotes(rawNotes) : [];
          }
        } else if (input.task.eventType === 'commit') {
          const sha = getGitlabCommitShaFromPayload(input.payload);
          if (projectId && sha) {
            const raw = await input.gitlab.listCommitComments(projectId, sha);
            commentNotes = raw.length ? normalizeGitlabCommitComments(raw) : [];
          }
        }
      } else if (provider === 'github') {
        if (!input.github) throw new Error('github client not configured');
        const slug = getGithubRepoSlug(input.payload);
        if (!slug) throw new Error('missing github repo slug');

        if (input.task.eventType === 'issue' && input.task.issueId) {
          commentNotes = notes;
        } else if (input.task.eventType === 'merge_request') {
          const prNumber =
            typeof input.payload?.issue?.number === 'number'
              ? input.payload.issue.number
              : typeof input.payload?.pull_request?.number === 'number'
                ? input.payload.pull_request.number
                : input.task.mrId;
          if (typeof prNumber === 'number') {
            const raw = await input.github.listIssueComments(slug.owner, slug.repo, prNumber);
            commentNotes = raw.length ? normalizeGithubComments(raw) : [];
          }
        } else if (input.task.eventType === 'commit') {
          const sha = getGithubCommitShaFromPayload(input.payload);
          if (sha) {
            const raw = await input.github.listCommitComments(slug.owner, slug.repo, sha);
            commentNotes = raw.length ? normalizeGithubCommitComments(raw) : [];
          }
        }
      }
    } catch (_err) {
      // ignore: if fetching comment history fails, fall back to only providing the current comment.
    }
  }

  const commentContext = isCommented
    ? commentNotes.length
      ? buildNotesContext(provider, input.payload, commentNotes, botUsernames)
      : buildSingleCommentContext(comment, botUsernames)
    : undefined;

  let commitContext: { sha?: string; message?: string } | undefined;
  if (input.task.eventType === 'commit' || input.task.eventType === 'commit_review' || input.task.eventType === 'push') {
    const sha = provider === 'gitlab' ? getGitlabCommitShaFromPayload(input.payload) : getGithubCommitShaFromPayload(input.payload);
    let message = extractCommitMessageFromPayload(provider, input.payload);

    if (!message && sha) {
      try {
        if (provider === 'gitlab') {
          if (!input.gitlab) throw new Error('gitlab client not configured');
          const projectId = getGitlabProjectId(input.task, input.payload);
          if (projectId) {
            const raw = await input.gitlab.getCommit(projectId, sha);
            message = String(raw.message ?? raw.title ?? '').trim();
          }
        } else if (provider === 'github') {
          if (!input.github) throw new Error('github client not configured');
          const slug = getGithubRepoSlug(input.payload);
          if (slug) {
            const raw = await input.github.getCommit(slug.owner, slug.repo, sha);
            message = String(raw.commit?.message ?? '').trim();
          }
        }
      } catch (_err) {
        // ignore: failing to enrich commit info should not break prompt building.
      }
    }

    const normalizedSha = sha && sha.trim() ? sha : undefined;
    const normalizedMessage = message && message.trim() ? message : undefined;
    if (normalizedSha || normalizedMessage) {
      commitContext = { sha: normalizedSha, message: normalizedMessage };
    }
  }

  const robotTemplate = String(input.robot.promptDefault ?? '').trim();
  const template = custom || robotTemplate;
  if (!template) throw new Error('prompt template is required');
  const rendered = renderTemplate(
    template,
    buildTemplateContext(input, { issue, commentContext, commit: commitContext, issueFetchFailed })
  );

  return { robot: input.robot, body: rendered };
};

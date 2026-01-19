import type { Task } from '../api';

/**
 * UI template helpers (task prompt preview).
 *
 * Business context:
 * - Module: Frontend / Task detail page.
 * - Purpose: render `{{path.to.value}}` variables against the current task payload so users can compare
 *   the raw prompt template with its rendered text for debugging.
 *
 * Important notes / assumptions:
 * - This is a best-effort preview renderer: missing variables are rendered as empty strings.
 * - Keep the syntax aligned with the backend template engine (`backend/src/agent/template.ts`).
 *
 * Change record:
 * - 2026-01-19: Add raw-vs-rendered prompt patch preview helpers. x0kprszlsorw9vi8jih9
 */

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const safeTrim = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const toFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
};

const getByPath = (obj: unknown, path: string): unknown => {
  if (!path) return undefined;
  const parts = path.split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const key of parts) {
    if (!isRecord(cur)) return undefined;
    cur = cur[key];
  }
  return cur;
};

/**
 * Render a template string using `{{path.to.value}}` substitutions.
 * - Missing variables are rendered as empty strings to match backend behavior.
 */
export const renderTemplate = (template: string, context: UnknownRecord): string =>
  String(template).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_raw, path: string) => {
    const value = getByPath(context, path);
    if (value === undefined || value === null) return '';
    return typeof value === 'string' ? value : String(value);
  });

export const buildTaskTemplateContext = (task: Task): UnknownRecord => {
  // Build a best-effort template context from task meta + payload for prompt preview. x0kprszlsorw9vi8jih9
  const payload: any = task.payload ?? {};

  const provider =
    safeTrim(task.repo?.provider ?? task.repoProvider) ||
    (payload?.repository ? 'github' : payload?.project ? 'gitlab' : '');

  const repoName =
    safeTrim(task.repo?.name) ||
    safeTrim(payload?.project?.path_with_namespace) ||
    safeTrim(payload?.repository?.full_name) ||
    safeTrim(payload?.repository?.name);

  const robotName = safeTrim(task.robot?.name);

  const refRaw = safeTrim(task.ref) || safeTrim(payload?.ref);
  const ref = refRaw.replace(/^refs\/heads\//, '').replace(/^refs\/tags\//, '');

  const issueNumber =
    toFiniteNumber(task.issueId) ??
    toFiniteNumber(payload?.issue?.iid) ??
    toFiniteNumber(payload?.issue?.number) ??
    toFiniteNumber(payload?.object_attributes?.iid);

  const issueId = toFiniteNumber(payload?.issue?.id) ?? toFiniteNumber(payload?.object_attributes?.id);

  const issueTitle = safeTrim(payload?.issue?.title) || safeTrim(payload?.object_attributes?.title);

  const issueBody =
    safeTrim(payload?.issue?.body) ||
    safeTrim(payload?.issue?.description) ||
    safeTrim(payload?.object_attributes?.description);

  const issueUrl = safeTrim(payload?.issue?.html_url) || safeTrim(payload?.issue?.web_url);

  const mrNumber =
    toFiniteNumber(task.mrId) ??
    toFiniteNumber(payload?.merge_request?.iid) ??
    toFiniteNumber(payload?.pull_request?.number) ??
    toFiniteNumber(payload?.object_attributes?.iid);

  const mrTitle =
    safeTrim(payload?.pull_request?.title) || safeTrim(payload?.merge_request?.title) || safeTrim(payload?.object_attributes?.title);

  const mrBody =
    safeTrim(payload?.pull_request?.body) || safeTrim(payload?.merge_request?.description) || safeTrim(payload?.object_attributes?.description);

  const mrUrl = safeTrim(payload?.pull_request?.html_url) || safeTrim(payload?.merge_request?.web_url);

  const mrSourceBranch = safeTrim(payload?.pull_request?.head?.ref) || safeTrim(payload?.merge_request?.source_branch);

  const mrTargetBranch = safeTrim(payload?.pull_request?.base?.ref) || safeTrim(payload?.merge_request?.target_branch);

  const commentBody =
    safeTrim(payload?.__chat?.text) || safeTrim(payload?.object_attributes?.note) || safeTrim(payload?.comment?.body);

  const commentAuthor =
    safeTrim(payload?.comment?.user?.login) || safeTrim(payload?.sender?.login) || safeTrim(payload?.user?.username) || safeTrim(payload?.user?.name);

  const commentCurrent = commentBody ? `${commentAuthor || 'unknown'}: ${commentBody}` : '';

  const commitSha =
    safeTrim(payload?.comment?.commit_id) ||
    safeTrim(payload?.checkout_sha) ||
    safeTrim(payload?.after) ||
    safeTrim(payload?.head_commit?.id) ||
    safeTrim(payload?.head_commit?.sha) ||
    safeTrim(payload?.commit?.id) ||
    safeTrim(payload?.commit?.sha);

  const commitMessage =
    safeTrim(payload?.head_commit?.message) ||
    safeTrim(payload?.commit?.message) ||
    safeTrim(payload?.head_commit?.title) ||
    safeTrim(payload?.commit?.title);

  return {
    repo: { id: safeTrim(task.repo?.id ?? task.repoId), provider, name: repoName, enabled: Boolean(task.repo?.enabled) },
    robot: {
      id: safeTrim(task.robot?.id ?? task.robotId),
      name: robotName,
      permission: safeTrim(task.robot?.permission),
      enabled: Boolean(task.robot?.enabled)
    },
    task: {
      id: task.id,
      eventType: task.eventType,
      title: safeTrim(task.title),
      ref,
      issueId: typeof task.issueId === 'number' ? task.issueId : '',
      mrId: typeof task.mrId === 'number' ? task.mrId : ''
    },
    issue: issueNumber !== undefined ? { number: issueNumber, id: issueId ?? '', title: issueTitle, body: issueBody, url: issueUrl } : undefined,
    mergeRequest:
      mrNumber !== undefined
        ? { number: mrNumber, title: mrTitle, body: mrBody, url: mrUrl, sourceBranch: mrSourceBranch, targetBranch: mrTargetBranch }
        : undefined,
    comment: { body: commentBody, author: commentAuthor, context: commentBody ? { current: commentCurrent, history: '' } : undefined },
    commit: commitSha || commitMessage ? { branch: ref, sha: commitSha, message: commitMessage } : undefined
  };
};

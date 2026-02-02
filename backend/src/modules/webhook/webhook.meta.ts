import type { TaskCreateMeta } from '../tasks/task.service';
import type { TaskEventType } from '../../types/task';
import { extractSubType } from './webhook.automation';
import { extractCommitTitle } from './webhook.commit';

// Split webhook task title/meta builders into a dedicated module. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
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

const buildGithubTaskTitle = (eventType: TaskEventType, payload: any): string | undefined => {
  const subType = extractSubType(payload);
  switch (eventType) {
    case 'commit': {
      if (subType === 'commented') {
        const raw = (payload?.comment?.body as string | undefined)?.trim();
        const snippet = raw ? raw.replace(/\s+/g, ' ').slice(0, 80) : '';
        return [snippet ? 'CommitComment' : 'Commit', snippet].filter(Boolean).join(' · ');
      }
      const ref = payload?.ref;
      const commits = Array.isArray(payload?.commits) ? payload.commits : [];
      // Prefer head_commit for GitHub push titles to align with webhook payload fields. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
      const headCommit = payload?.head_commit ?? (commits.length ? commits[commits.length - 1] : undefined);
      const commitSha: string | undefined = typeof headCommit?.id === 'string' ? headCommit.id : undefined;
      const commitShort = commitSha ? commitSha.slice(0, 8) : '';
      const commitTitle = extractCommitTitle(headCommit);
      const snippet = commitTitle ? commitTitle.replace(/\s+/g, ' ').slice(0, 80) : '';
      const base = ['Commit', ref].filter(Boolean).join(' ');
      const extra = [commitShort, snippet].filter(Boolean).join(' · ');
      return extra ? `${base} · ${extra}` : base;
    }
    case 'commit_review':
    case 'push': {
      const ref = payload?.ref;
      const label = eventType === 'commit_review' ? 'CommitReview' : 'Push';
      if (ref) return [label, ref].join(' ');
      break;
    }
    case 'merge_request': {
      if (subType === 'commented') {
        const raw = (payload?.comment?.body as string | undefined)?.trim();
        const snippet = raw ? raw.replace(/\s+/g, ' ').slice(0, 80) : '';
        const prNumber = payload?.issue?.number ?? payload?.pull_request?.number;
        return ['PRComment', prNumber ? `#${prNumber}` : undefined, snippet].filter(Boolean).join(' · ');
      }
      const pr = payload?.pull_request;
      const number = pr?.number;
      const title = pr?.title;
      const label = subType === 'updated' ? 'PRUpdated' : 'PR';
      if (number || title) return `${label}${number ? ` #${number}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue': {
      if (subType === 'commented') {
        const raw = (payload?.comment?.body as string | undefined)?.trim();
        const snippet = raw ? raw.replace(/\s+/g, ' ').slice(0, 80) : '';
        const issueNumber = payload?.issue?.number;
        return ['IssueComment', issueNumber ? `#${issueNumber}` : undefined, snippet].filter(Boolean).join(' · ');
      }
      const issue = payload?.issue;
      const number = issue?.number;
      const title = issue?.title;
      const label = subType === 'created' ? 'IssueCreated' : 'Issue';
      if (number || title) return `${label}${number ? ` #${number}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue_created': {
      const issue = payload?.issue;
      const number = issue?.number;
      const title = issue?.title;
      const label = eventType === 'issue_created' ? 'IssueCreated' : 'Issue';
      if (number || title) return `${label}${number ? ` #${number}` : ''}: ${title ?? ''}`.trim();
      break;
    }
    case 'issue_comment':
    case 'note': {
      const raw = (payload?.comment?.body as string | undefined)?.trim();
      const issueNumber = payload?.issue?.number;
      const label = eventType === 'issue_comment' ? 'IssueComment' : 'Note';
      if (raw) {
        const snippet = raw.replace(/\s+/g, ' ').slice(0, 80);
        return [label, issueNumber ? `#${issueNumber}` : undefined, snippet].filter(Boolean).join(' · ');
      }
      if (issueNumber) return [label, `#${issueNumber}`].filter(Boolean).join(' · ');
      break;
    }
  }
  return payload?.action;
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
export const __test__buildTaskMeta = buildTaskMeta;

// Unit-test only: avoid relying on Express routing behavior to indirectly verify metadata extraction logic.
export const __test__buildGithubTaskMeta = buildGithubTaskMeta;

export { buildTaskMeta, buildGithubTaskMeta };

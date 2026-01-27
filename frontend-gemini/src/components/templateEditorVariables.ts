import type { MessageKey } from '../i18n';

/**
 * Template editor variables:
 * - Business context: prompt templates (robot default prompt, automation prompt patch/override).
 * - Purpose: provide a curated list of supported placeholders so users can insert them safely.
 *
 * Change record:
 * - 2026-01-12: Ported from legacy `frontend` to support RepoDetail automation + robot prompt editing.
 */

export interface TemplateVariable {
  path: string;
  label: string;
  description?: string;
}

export interface TemplateVariableGroup {
  labelKey: MessageKey;
  options: TemplateVariable[];
}

export type TemplateVariableScope = 'all' | 'issue' | 'commit' | 'merge_request' | (string & {});

const GROUP_REPO: TemplateVariableGroup = {
  labelKey: 'templateEditor.group.repo',
  options: [
    { path: 'repo.id', label: 'repo.id' },
    { path: 'repo.name', label: 'repo.name' },
    { path: 'repo.provider', label: 'repo.provider' },
    { path: 'repo.externalId', label: 'repo.externalId' },
    { path: 'repo.defaultBranch', label: 'repo.defaultBranch' },
    { path: 'repo.branchesText', label: 'repo.branchesText' }
  ]
};

const GROUP_ROBOT: TemplateVariableGroup = {
  labelKey: 'templateEditor.group.robot',
  options: [
    { path: 'robot.id', label: 'robot.id' },
    { path: 'robot.name', label: 'robot.name' },
    { path: 'robot.permission', label: 'robot.permission' },
    { path: 'robot.language', label: 'robot.language' }
  ]
};

const GROUP_TASK: TemplateVariableGroup = {
  labelKey: 'templateEditor.group.task',
  options: [
    { path: 'task.id', label: 'task.id' },
    { path: 'task.eventType', label: 'task.eventType' },
    { path: 'task.title', label: 'task.title' },
    { path: 'task.ref', label: 'task.ref' },
    { path: 'task.issueId', label: 'task.issueId' },
    { path: 'task.mrId', label: 'task.mrId' }
  ]
};

const GROUP_ISSUE: TemplateVariableGroup = {
  labelKey: 'templateEditor.group.issue',
  options: [
    { path: 'issue.id', label: 'issue.id' },
    { path: 'issue.number', label: 'issue.number' },
    { path: 'issue.title', label: 'issue.title' },
    { path: 'issue.url', label: 'issue.url' },
    { path: 'issue.body', label: 'issue.body', description: 'Issue body' }
  ]
};

const GROUP_COMMIT: TemplateVariableGroup = {
  labelKey: 'templateEditor.group.commit',
  options: [
    { path: 'commit.branch', label: 'commit.branch' },
    { path: 'commit.sha', label: 'commit.sha', description: 'Commit hash (SHA)' },
    { path: 'commit.message', label: 'commit.message', description: 'Commit message' }
  ]
};

const GROUP_MERGE_REQUEST: TemplateVariableGroup = {
  labelKey: 'templateEditor.group.mergeRequest',
  options: [
    { path: 'mergeRequest.id', label: 'mergeRequest.id' },
    { path: 'mergeRequest.number', label: 'mergeRequest.number' },
    { path: 'mergeRequest.title', label: 'mergeRequest.title' },
    { path: 'mergeRequest.url', label: 'mergeRequest.url' },
    { path: 'mergeRequest.body', label: 'mergeRequest.body' },
    { path: 'mergeRequest.sourceBranch', label: 'mergeRequest.sourceBranch' },
    { path: 'mergeRequest.targetBranch', label: 'mergeRequest.targetBranch' }
  ]
};

const COMMENT_BASE: TemplateVariable[] = [
  { path: 'comment.body', label: 'comment.body' },
  { path: 'comment.author', label: 'comment.author' }
];

const COMMENT_CONTEXT: TemplateVariable[] = [
  {
    path: 'comment.context.current',
    label: 'comment.context.current',
    description: 'Current comment context (excluding bot comments)'
  },
  {
    path: 'comment.context.history',
    label: 'comment.context.history',
    description: 'Historical comment context (excluding bot comments)'
  }
];

const groupComment = (options: TemplateVariable[]): TemplateVariableGroup => ({
  labelKey: 'templateEditor.group.comment',
  options
});

export const TEMPLATE_VARIABLE_GROUPS_ALL: TemplateVariableGroup[] = [
  GROUP_REPO,
  GROUP_ROBOT,
  GROUP_TASK,
  GROUP_ISSUE,
  GROUP_COMMIT,
  GROUP_MERGE_REQUEST,
  groupComment([...COMMENT_BASE, ...COMMENT_CONTEXT])
];

export const getTemplateVariableGroups = (scope: TemplateVariableScope): TemplateVariableGroup[] => {
  const base = [GROUP_REPO, GROUP_ROBOT, GROUP_TASK];

  if (scope === 'issue') return [...base, GROUP_ISSUE, groupComment([...COMMENT_BASE, ...COMMENT_CONTEXT])];
  if (scope === 'commit') return [...base, GROUP_COMMIT, groupComment([...COMMENT_BASE, ...COMMENT_CONTEXT])];
  if (scope === 'merge_request') return [...base, GROUP_MERGE_REQUEST, groupComment([...COMMENT_BASE, ...COMMENT_CONTEXT])];

  return TEMPLATE_VARIABLE_GROUPS_ALL;
};


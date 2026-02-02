// Re-export webhook handlers from split modules to preserve import paths. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202
export { handleGitlabWebhook } from './webhook.gitlab';
export { handleGithubWebhook } from './webhook.github';
export { __test__buildGithubTaskMeta, __test__buildTaskMeta } from './webhook.meta';
export type { WebhookDeps } from './webhook.types';

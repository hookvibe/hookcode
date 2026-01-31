# Findings: Move repo pull to task group workspace

## 2026-01-24
- Repository root contains backend/frontend and docs; planning session initialized at docs/en/developer/plans/tgpull2wkg7n9f4a.
- Repo clone/pull currently happens per task in backend/src/agent/agent.ts (repoDir = BUILD_ROOT + provider__repoSlug__refSlug; clone/pull/fetch/checkout happens before provider execution).
- Task groups are created in backend/src/modules/tasks/task.service.ts via ensureTaskGroupId / resolveOrCreateGroupId; task_groups schema currently has no workspace field.
- Thought chain UI renders JSONL log lines (type: item.* / assistant / system) into ExecutionTimeline; plain [agent] logs are not parsed into thought chain items.
- Task push service (backend/src/modules/tasks/task-git-push.service.ts) derives repoDir using BUILD_ROOT + provider__repoSlug__refSlug, so any workspace path change must be shared.

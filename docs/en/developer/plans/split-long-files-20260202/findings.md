# Findings & Decisions: Split long files for maintainability
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. split-long-files-20260202 */}

## Session Metadata
- **Session Hash:** split-long-files-20260202
- **Created:** 2026-02-02

## Requirements
- Identify long files suitable for splitting by responsibility to reduce merge conflicts.
- Ensure docs that reference moved/renamed files or anchors are updated.
- Add long-file splitting guidance to `AGENTS.md`.
- Keep inline traceability comments in every changed area with plan path + session hash.

## Research Findings
- <!-- Record test failure context for webhook meta changes. docs/en/developer/plans/split-long-files-20260202/task_plan.md split-long-files-20260202 -->
- Failing test `webhookTaskMeta` expects GitHub commit titles to include `head_commit.message`; buildGithubTaskTitle now prefers `head_commit` when available.
- Longest code files (by lines) include `frontend/src/pages/RepoDetailPage.tsx`, `backend/src/agent/agent.ts`, `backend/src/modules/repositories/repositories.controller.ts`, `frontend/src/components/UserPanelPopover.tsx`, `frontend/src/pages/TaskGroupChatPage.tsx`, `frontend/src/api.ts`, `frontend/src/pages/TaskDetailPage.tsx`, `backend/src/modules/tasks/task.service.ts`, and `backend/src/modules/webhook/webhook.handlers.ts`.
- `frontend/src/api.ts` contains axios client setup, GET cache helpers, shared API types, and a large set of exported request helpers.
- `frontend/src/api.ts` sections can be grouped into: client/cache setup, shared types, task groups + previews, task APIs, auth/user APIs, model credentials/token APIs, system metadata, repo/robot/automation APIs, and webhook delivery APIs.
- `backend/src/modules/webhook/webhook.handlers.ts` defines `handleGitlabWebhook` (~line 762) and `handleGithubWebhook` (~line 1082) and includes the delivery recorder, verification, and mapping logic in the same file.
- `backend/src/modules/webhook/webhook.handlers.ts` includes `__test__buildTaskMeta` and `__test__buildGithubTaskMeta` exports used by unit tests.
- Helper functions around webhook task metadata include `buildTaskTitle`, `buildTaskMeta`, `buildGithubTaskTitle`, `buildGithubTaskMeta`, commit extractors, and guard helpers like `canCreateGitlabAutomationTask`/`canCreateGithubAutomationTask`.
- `isInlineWorkerEnabled` is a shared helper used in both GitLab and GitHub handlers for inline worker triggering.
- GitHub handler mirrors GitLab flow (repo lookup, verification, automation mapping, task creation) and can be moved into a provider-specific module while keeping `webhook.handlers.ts` as the public entry point.
- Docs contain many references to `frontend/src/api.ts`, mostly in historical plan files; keeping `api.ts` as the public entry point avoids mass doc edits.
- `backend/src/modules/webhook` currently contains only `webhook.*.ts` files (no helper submodules yet).
- Current `AGENTS.md` enforces planning-with-files and inline traceability comments but does not mention splitting long files.
- Frontend API was split into `frontend/src/api/*` modules with `frontend/src/api.ts` acting as a barrel for compatibility.
- Webhook handlers were split into provider/helper modules under `backend/src/modules/webhook/` while keeping `webhook.handlers.ts` as the entry point.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Keep `frontend/src/api.ts` as a barrel and split functionality into `api.*.ts` modules. | Avoid mass doc updates while reducing file size and merge conflicts. |
| Extract webhook task-meta and guard helpers into new `webhook.*.ts` modules while keeping `webhook.handlers.ts` as entry point. | Reduce handler file size without breaking existing imports/tests or doc references. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `docs/en/developer/plans/split-long-files-20260202/task_plan.md`
- `AGENTS.md`
- `frontend/src/api.ts`
- `backend/src/modules/webhook/webhook.handlers.ts`

## Visual/Browser Findings
- None.

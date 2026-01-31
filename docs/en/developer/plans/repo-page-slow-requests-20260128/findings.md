# Findings & Decisions: Investigate slow repo page requests



# Findings & Decisions: Investigate slow repo page requests
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. repo-page-slow-requests-20260128 */}

## Session Metadata
- **Session Hash:** repo-page-slow-requests-20260128
- **Created:** 2026-01-28

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Check backend and database design for slow repo page loading, especially repo-related endpoints, and suggest fixes.
- Add build-time performance requirements into `AGENTS.md`.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- User provided a repo page waterfall showing repeated slow XHR calls (tasks, webhook-deliveries, provider-meta, stats, volume, sidebar, provider-activity), with multi-second to minute-level latencies.
- Backend repo endpoints live in `backend/src/modules/repositories/repositories.controller.ts`, including `/repos/:id/provider-meta`, `/repos/:id/provider-activity`, and `/repos/:id/webhook-deliveries` (provider calls + DB lookups).
- Dashboard sidebar endpoint (`/dashboard/sidebar`) fans out in parallel to 6 task service calls (stats + 4 status lists + task groups), so it can amplify DB latency on load.
- Task list, stats, and volume endpoints are in `backend/src/modules/tasks/tasks.controller.ts` and rely on `TaskService` methods for list/stats/volume queries.
- `TaskService.listTasks` uses raw SQL with UNION ALL per-status queries, filtering by repo/robot/event/archived and ordering by `updated_at`, which is sensitive to missing composite indexes (repo_id, status, updated_at, archived_at).
- Prisma schema shows `Task` indexes only on `(status, createdAt)`, `(groupId, createdAt)`, and `archivedAt`, with no index on `repo_id`, `robot_id`, `event_type`, or `updated_at` despite heavy filtering/sorting.
- `TaskGroup` lacks indexes on `commit_sha`, `mr_id`, `issue_id` which are used in provider activity bindings; this can cause full scans for repo dashboard activity joins.
- Frontend `RepoDetailPage` triggers `/repos/:id/provider-meta`, `/repos/:id/provider-activity`, `/repos/:id/webhook-deliveries`, plus task stats/list/volume endpoints, matching the slow calls observed in the waterfall.
- `RepoTaskActivityCard` issues `fetchTaskStats` plus `fetchTasks({ repoId, limit: 200 })` on mount, which can be heavy if task queries are unindexed.
- `RepoTaskVolumeTrend` calls `fetchTaskVolumeByDay` on mount for a date range, issuing an aggregate query over tasks by `created_at`.
- `RepoDetailProviderActivityRow` first calls `fetchRepoProviderMeta` and then `fetchRepoProviderActivity` (commits/merges/issues), which hits external provider APIs and then joins task groups, creating potentially slow sequential requests.
- Both `RepoWebhookActivityCard` and `RepoWebhookDeliveriesPanel` call `listRepoWebhookDeliveries(repoId, { limit: 50 })` on mount, duplicating the same query and amplifying slow delivery queries.
- `TaskService.attachQueueDiagnosis` runs extra raw SQL against the global `tasks` table (status='queued' and status='processing') when any queued tasks are in the list, which can add cost to repo-scoped task lists.
- `GET /repos/:id` in `repositories.controller.ts` performs several sequential DB calls (repo, robots, automation config, secret, scoped credentials); if any of these are slow it delays the initial repo page load.
- TasksPage uses `fetchTasks` + `fetchTaskStats` on mount for each status filter; repo/global lists need indexes for status + updated_at to avoid slow scans.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add `includeQueue` toggle to `/tasks` and disable queue diagnosis in sidebar/task activity | Avoid extra global queue queries when dashboards only need summary task lists. |
| Cache provider meta/activity calls in-memory with TTL | Reduce repeated external API latency on repo dashboards while keeping data reasonably fresh. |
| Share webhook deliveries fetch across repo dashboard cards | Remove duplicate requests and reduce backend load on page open. |
| Add repo-scoped task/task-group/webhook indexes | Align database indexes with hot repo dashboard queries. |
| Add build performance budgets to AGENTS.md | Enforce build-time performance expectations to prevent regressions. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
-

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## Session Metadata
- **Session Hash:** repo-page-slow-requests-20260128
- **Created:** 2026-01-29

## Requirements


-

## Research Findings


-

## Technical Decisions


| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered


| Issue | Resolution |
|-------|------------|
|       |            |

## Resources


-

## Visual/Browser Findings



-

---

*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

- Confirmed planning-with-files skill instructions and workflow requirements before continuing implementation.

- Reviewed current task plan (Phase 3 in_progress) and confirmed frontend api.ts already contains GET cache/dedupe helpers (getCached/invalidate*).

- api.ts already migrated task group/task list/stats/volume/sidebar/task detail/auth/me/admin/system endpoints to getCached, but repo and provider endpoints still appear later in file and likely need migration.

- Repo-related API methods (listRepos, fetchRepo, provider meta/activity, webhook deliveries, robots, credentials) still use raw axios without caching/dedupe and need migration plus cache invalidation on mutations.

- TasksPage currently calls fetchTasks without includeQueue=false; should pass includeQueue:false for list views and update tests accordingly.

- ArchivePage uses listRepos and fetchTasks without includeQueue; listRepos is used across TaskGroupChatPage and ReposPage, so migrating listRepos to cached/dedupe will affect multiple pages/tests.

- ReposPage loads listRepos and then fetchRepo per repo for summary; TaskGroupChatPage refreshes listRepos/listRepoRobots for chat setup. These should leverage GET cache/dedupe with short TTL and proper invalidation.

- Repo detail provider activity row repeatedly calls provider meta/activity based on credential changes; caching/dedupe at API layer should reduce repeated requests without altering component logic.

- tasksPage.test expects fetchTasks params without includeQueue; will need updates when adding includeQueue:false to TasksPage and ArchivePage calls.

- Frontend tests ran successfully but emitted the existing Vite CJS deprecation warning and a css-tools sourcemap missing warning.

- Confirmed all frontend GET endpoints in api.ts now route through getCached; raw api.get calls removed for repo-related endpoints.

- Verified working tree still contains many pre-existing modified files; new changes limited to API caching, task/archive params, tests, and plan docs for this session.

- CI failure traced to TypeScript TS2358 in repositories.controller.ts (instanceof Date on repo.updatedAt).

- Fixed repositories.controller.ts cache key updatedAt normalization to avoid TS instanceof error; CI failing tests pass locally.

- CI frontend failure traced to missing listRepoWebhookDeliveries export in AppShell API mock and RepoWebhookDeliveriesPanel test expecting internal fetch after component refactor.

- Updated AppShell API mock to include webhook delivery exports and adjusted RepoWebhookDeliveriesPanel test to pass deliveries via props after refactor.

- Identified Vitest setup file (frontend/src/tests/setup.ts) as the right place to filter AntD/Vite warning noise in test output.

- Backend Jest config lacks a setup file; we can add setupFilesAfterEnv to filter known console warnings/errors during tests.

- Frontend Vite warnings still emitted after console filtering; need to suppress via Vite/Vitest config (likely logLevel or warning filters) since they bypass console.warn.

- Vite CJS deprecation warning is emitted from Vite index.cjs unless VITE_CJS_IGNORE_WARNING is set before Vitest starts; added wrapper script to set env early.

- Added Jest/Vitest setup filters plus a Vitest wrapper script to silence known test-only warnings (AntD deprecations, Vite CJS warning, css-tools sourcemap).

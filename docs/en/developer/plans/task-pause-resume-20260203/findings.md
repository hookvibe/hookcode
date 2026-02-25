# Findings & Decisions: Add pause/resume for task group executions
<!-- Capture pause/resume requirements and discoveries. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->



# Findings & Decisions: Add pause/resume for task group executions
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. task-pause-resume-20260203 */}

## Session Metadata
- **Session Hash:** task-pause-resume-20260203
- **Created:** 2026-02-03

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Provide a mid-run pause/stop control for task-group executions (not delete).
- Allow resuming later.
- Add controls in task-group chat page and task detail page; task-group page send button becomes pause while running.
<!-- Extend requirements to cover worker reuse, deletion handling, and empty-group display. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Skip git pull/dependency install when the same worker handles a non-first task in a task group.
- If task-group logs exist but no workspace on this worker, warn that a new environment will be used.
- When a task group has only one task that gets deleted, reopening the group should show a proper empty state instead of a broken dialog-only view.
- Deleting tasks should stop in-flight executions so resumeThread does not continue after deletion.
- When a new task is created, avoid a long "No logs" blank state; show a brief stage hint so users know execution is progressing.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Planning files initialized for task-pause-resume-20260203.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
|          |           |

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
- **Session Hash:** task-pause-resume-20260203
- **Created:** 2026-02-04

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
- Confirmed planning-with-files skill requirements: keep task_plan/findings/progress updated, follow 2-action rule, and include plan-link+hash inline comments for every change.
- Reviewed task_plan.md: Phase 1 is in progress; key questions focus on paused state and existing stop/interrupt UI.
- Noted findings.md currently contains duplicated template sections; avoid further duplication when updating.
- backend/src/agent/agent.ts already checks task-group workspace readiness; if logs exist but no workspace, it appends a log warning about using a new environment due to environment change.
- Workspace reuse logic: reuseWorkspace = workspaceReady && hasPriorTaskGroupTask; allowNetworkPull is disabled when reusing.
- backend/src/agent/agent.ts skips dependency installs when reuseWorkspace is true and logs the skip; reuseWorkspace is based on workspaceReady and prior task-group history.
- allowNetworkPull flag is derived from reuseWorkspace to gate git network sync; verify in clone/pull path.
- backend/src/tests/unit/taskDeleteThreadReset.test.ts expects deleteTask to clear taskGroup.threadId when the last task is removed; user report suggests this may not be happening in practice.
- TaskService.hasPriorTaskGroupTask checks for any other task row in the group (no status/archived filtering), so any remaining task rows will cause resumeThread/workspace reuse logic to trigger.
- TaskService.hasTaskGroupLogs queries stored logs in result_json for any task in the group.
- TaskService.deleteTask hard-deletes the task row and clears taskGroup.threadId when remaining count is zero; if resumeThread still executes, deletion might be bypassing this path or tasks are not truly deleted.
- Frontend uses api.deleteTask in TaskDetailPage; need to inspect TaskGroupChatPage deletion path.
- TaskGroupChatPage and TaskConversationItem do not reference delete/remove directly; deletion flow might be only in TaskDetailPage or elsewhere.
- TaskGroupChatPage treats groups as "blocking" until group?.id matches taskGroupId; empty state is shown only when orderedTasks length is zero and not blocking.
- Empty-group view already exists (chat.page.emptyGroup) when a group has zero tasks; issue may be around state refresh or group readiness after deletions.
- TaskConversationItem always renders the dialog-style log viewer for each task; if a stale task remains in state after deletion, the chat view would still show only the log card for that task.
- TaskGroupChatPage manages tasks state via setTasks; need to inspect refresh/reset behavior when tasks are deleted or group changes.
- TaskGroupChatPage keeps tasks state in a long-lived component; orderedTasks is derived directly from tasks state.
- If tasks are deleted elsewhere (TaskDetailPage), TaskGroupChatPage may not refresh automatically, leaving stale items; consider refresh on focus or after delete event.
- TaskGroupChatPage refreshes group + tasks on mount and polls every 5s; stale tasks after deletion should clear unless refresh fails.
- isGroupBlocking depends on group?.id; if group fetch fails (404), UI can stay in blocking state with no empty-group messaging.
- agent.ts resumes threads only when hasPriorTaskGroupTask returns true; resumeThreadId comes from taskGroup.threadId.
- TaskService exposes getTaskGroupThreadId/bindTaskGroupThreadId; need to verify deletion/archival paths to ensure threadId clears when last task is removed.
- TaskService has archive filtering for list endpoints but hasPriorTaskGroupTask does not exclude archived tasks; if tasks are archived instead of deleted, resumeThread/workspace reuse can still trigger.
- TasksController DELETE /tasks/:id calls TaskService.deleteTask and should clear threadId when last task is removed.
- task-groups controller does not expose delete endpoints; group lifecycle seems tied to tasks rather than explicit deletion.
- TaskRunner processes tasks serially and always finalizes to succeeded/failed; no pause/abort handling exists yet.
- AgentService.callAgent is a thin wrapper around agent.callAgent and currently has no AbortSignal support.
- Codex and Claude provider runners already accept AbortSignal (via runStreamed/abortController), so pause/stop can be implemented by threading a signal into agent execution.
- TaskService.retryTask simply sets status=queued; there is no generic payload update method besides setTaskScheduleOverride, so resume metadata may need a new method or use patchResult.
- agent.ts calls runCodex/Claude/Gemini without passing AbortSignal today; signal support must be threaded through callAgent and provider invocations for pause/stop.
- TasksController retry endpoint returns decorated task and triggers TaskRunner when INLINE_WORKER_ENABLED; pause/resume endpoints can mirror this pattern.
- tasks-swagger.dto TaskWithMetaDto status enum lacks 'paused'; TaskStatusStatsDto has no paused count, so stats/UI will need updates if paused is surfaced.
- TaskService.getTaskStats currently buckets queued/processing/failed/success only; paused tasks would be ignored unless added to stats.
- Frontend TaskStatus type and statusTag mapping lack 'paused'; UI filters and tags need updates.
- i18n core messages list task.status.* keys; paused label will need additions for en-US and zh-CN.
- AppShell renders TaskGroupChatPage when showChatPage is true, passing chatGroupId; component may unmount depending on route logic (needs check for empty-group refresh behavior).
- AppShell only mounts TaskGroupChatPage on home/taskGroup routes; leaving to TaskDetailPage unmounts it, so state should refresh when reopening the group.
- task-groups controller returns 404 when a group id is missing; TaskGroupChatPage error handling currently resets group/tasks but keeps blocking state.
- Frontend API types define TaskStatus without paused; TaskStatusStats is declared in frontend/src/api/types/tasks.ts and will need updates if paused is tracked.
- TaskStatusStats in frontend API types omits paused; taskFilters normalizeStatusFilter does not accept paused.
- Backend TaskStatusStats interface lives in TaskService; paused count should be added there along with DTOs if surfaced.
- TasksController normalizeTaskStatusFilter does not accept paused; needs update for pause filtering.
- agent.ts wraps all execution errors (including aborts) in AgentExecutionError after posting failure comments; pause/stop needs special handling to avoid failure posting on abort.
- TaskDetailPage and TaskGroupChatPage tests mock api module; new pause/resume APIs must be added to those mocks to prevent test failures and to cover new buttons.
- Dashboard sidebar DTO/tasksByStatus only lists queued/processing/success/failed; paused tasks need to be mapped or added for sidebar counts.
- TaskService.listTasks uses a generic status filter for non-success statuses, so paused will be handled once TaskStatus allows it.
- TaskLogViewer/ExecutionTimeline display generic empty log messages (logViewer.empty / execViewer.empty.timeline) when no logs or structured events are present; they do not include task status context today.
- TaskLogViewer is used in TaskConversationItem (variant=flat) and TaskDetailPage; adding optional empty-state hints there can address the "No logs" UX for new tasks.

<!-- Log planning-with-files skill check for session continuity. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Confirmed planning-with-files skill instructions are active for this session and will be followed.

<!-- Note plan/progress read to sync phase status before edits. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Re-read task_plan.md and progress.md to align with Phase 3 work; progress log still template and needs session updates.

<!-- Track missing traceability comment around task stats changes. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- getTaskStats in backend/src/modules/tasks/task.service.ts includes paused stats but lacks session traceability comments around the new logic.

<!-- Track appShell test stats audit for paused field coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- appShell.test.tsx already includes paused in several mocks, but full file needs a scan for any remaining stats objects missing paused.

<!-- Record missing paused field in appShell sidebar test stats. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- appShell.test.tsx has a stats mock (SSE refresh) missing paused (line ~570) and needs update with traceability comment.

<!-- Note existing TaskRunner unit tests as a base for pause/resume coverage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TaskRunner unit tests (taskRunnerFinalize.test.ts) provide a pattern for adding pause/abort coverage in backend tests.

<!-- Record taskService getTaskStats unit test missing paused field. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- backend/src/tests/unit/taskServiceListTasks.test.ts expects getTaskStats without paused; needs updates to include paused counts in both mock rows and expected stats.

<!-- Capture testing gap for pause/resume API or runner abort flows. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Backend unit tests cover task deletion thread reset but no pause/resume-specific tests yet; need to add new coverage (service/controller/runner).

<!-- Capture AgentExecutionError aborted flag in agent.ts for test mocks. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- backend/src/agent/agent.ts exposes AgentExecutionError.aborted flag; test mocks should include it when exercising pause/resume abort flows.

<!-- Confirm pause/resume traceability comments present in task service and runner. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- task.service.ts and task-runner.service.ts now include session traceability comments for paused handling sections.

<!-- Confirm resumeThread gating lives in agent.ts and relies on hasPriorTaskGroupTask. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- agent.ts resumes model threads only when hasPriorTaskGroupTask returns true; backend change to exclude archived tasks should address resumeThread-after-delete.

<!-- Track dashboardController unit test stats missing paused field. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- backend/src/tests/unit/dashboardController.test.ts stats mocks lack paused and need updates for new TaskStatusStats shape.

<!-- Record frontend tests missing paused in fetchTaskStats mocks. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- frontend tasksPage.test.tsx and repoDetailPage.test.tsx still mock fetchTaskStats without paused; update mocks to match new stats shape.

<!-- Confirm locations in tasksPage/repoDetail tests needing paused stat updates. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Located fetchTaskStats mocks in tasksPage.test.tsx and repoDetailPage.test.tsx that need paused added with traceability comments.

<!-- Note taskGroupExecutionHints test needs archivedAt condition update. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- backend/src/tests/unit/taskGroupExecutionHints.test.ts expects hasPriorTaskGroupTask query without archivedAt filter; update to match new archived exclusion.

<!-- Note RepoTaskActivityCard default stats missing paused and distribution ignores paused. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- frontend/src/components/repos/RepoTaskActivityCard.tsx uses a default TaskStatusStats without paused; update default and consider paused in distribution/hasAnyTasks.

<!-- Note repo dashboard activity card needs paused i18n labels if added to distribution. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Repo dashboard activity status labels only include queued/processing/success/failed; add paused label if distribution includes paused.

<!-- Note no existing frontend tests target RepoTaskActivityCard or repo activity status labels. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- No frontend tests reference RepoTaskActivityCard status labels; paused label change requires no test updates.

<!-- Confirm repo activity card now only TaskStatusStats component in frontend and has paused default. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- RepoTaskActivityCard is the only component using TaskStatusStats directly and now includes paused in defaults.

<!-- Note dashboard sidebar still lists queued/processing/success/failed tasks only; paused appears only in stats. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- DashboardController sidebar response does not list paused tasks in tasksByStatus (only stats include paused).

<!-- Confirm task group and detail pages have pause/resume traceability comments. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TaskGroupChatPage and TaskDetailPage contain session traceability comments for pause/resume and empty-state logic.

<!-- Record test command expectations for full suite. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Root test script runs backend and frontend tests via `pnpm test` (backend jest + frontend vitest).

<!-- Log test failures: pause/resume buttons not found in TaskGroupChatPage/TaskDetailPage. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- pnpm test failed: TaskGroupChatPage composer and TaskDetailPage tests could not find Pause/Resume buttons; UI may be rendering different labels or conditions.

<!-- Note TaskGroupChatPage composer uses i18n label for pause/resume; tests may need to match localized text. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TaskGroupChatPage composer action label comes from i18n keys (chat.form.pause/resume), so tests should use the localized label.

<!-- Note controlMode in TaskGroupChatPage depends on processing/paused tasks; tests may need matching label from i18n. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- controlMode is derived from orderedTasks (latest processing/paused), so test mocks must ensure orderedTasks includes that task and i18n label matches.

<!-- Note TaskGroupChatPage refreshGroupDetail sets tasks from fetchTaskGroupTasks; pause button appears only after refresh completes. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TaskGroupChatPage derives controlMode from orderedTasks populated in refreshGroupDetail; tests may need to await fetchTaskGroupTasks completion before querying Pause.

<!-- Record test updates: pause/resume button accessible names include icon labels. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Updated pause/resume tests to match button accessible names that include AntD icon labels.

<!-- Capture current diff scope after pause/resume implementation. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- git diff shows pause/resume changes across backend services, frontend UI, i18n, and tests; changelog already has an entry pending review.

<!-- Record changelog entry added for task-pause-resume session. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- Added task-pause-resume-20260203 entry to docs/en/change-log/0.0.0.md.

<!-- Verify worker env reuse + env-change warning implementation. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- agent.ts confirms: if taskGroup logs exist but workspace missing, logs warn about new environment; reuseWorkspace skips git pull and dependency install on same worker.

<!-- Verify empty-group UI and log stage hints for task groups. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TaskGroupChatPage renders explicit empty/missing group state instead of dialog-only view; TaskConversationItem provides queued/processing/paused log stage hints.

<!-- Confirm task detail logs use stage hints for empty log states. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TaskDetailPage passes emptyMessage/emptyHint into TaskLogViewer for queued/processing/paused statuses.

<!-- Confirm task deletion path calls deleteTask (thread reset) in controller. docs/en/developer/plans/task-pause-resume-20260203/task_plan.md task-pause-resume-20260203 -->
- TasksController delete endpoint calls taskService.deleteTask, so threadId reset logic runs on task deletion.

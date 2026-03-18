# Findings
{/* Capture task-group discovery notes for the workspace refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}

## Session Metadata
- **Session Hash:** taskgroup-ui-refactor-20260306
- **Created:** 2026-03-06

## Requirements
- Remove the expandable inline log area from task cards on the task group page.
- Open task execution logs in the right-side workspace as tabs, alongside preview tabs.
- Redesign the left side from a conversation layout into a submission-and-queue task card layout.
- Merge Git-related display content into the task card instead of a separate conversation block.
- Remove pause and resume task states from the product flow.
- Allow new tasks to be submitted while the task group already has queued work.
- Allow queued tasks to be edited or deleted before execution.
- Allow running tasks to be stopped only; a manually stopped task is treated as failed with a manual-stop reason.
- Show task execution order clearly with backend-linked ordering data and visible UI connectors.
- Add task card actions such as retry, move earlier, move later, insert next, and cancel.
- Exclude logs from the initial task group request and fetch logs only when the user opens them.

## Research Findings
- The repository contains dedicated frontend and backend AGENTS rules for i18n, theme support, backend/frontend sync, and backend build verification.
- Planning session files were initialized successfully under `docs/en/developer/plans/taskgroup-ui-refactor-20260306/`, but the helper script reported a Mintlify navigation mismatch in `docs/docs.json`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use this session hash: `taskgroup-ui-refactor-20260306`. | A stable hash is required for code-comment traceability and changelog linkage. |
| Treat the task group refactor as a combined frontend and backend change. | The requested queue actions and log-loading behavior require API and state changes. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` returned a docs navigation error. | Keep working with the created files, then update docs navigation manually if the touched docs need it. |

## Resources
- `AGENTS.md`
- `frontend/AGENTS.md`
- `backend/AGENTS.md`
- `docs/AGENTS.md`
- `.codex/skills/file-context-planning/SKILL.md`

## Visual/Browser Findings
- No visual inspection performed yet.

## Research Findings Update: 2026-03-06 17:01 CST
{/* Record the first concrete frontend and backend touch points for the task-group refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- The task-group detail page lives in `frontend/src/pages/TaskGroupChatPage.tsx` and is still a large chat-style component with left/right split layout, preview panel resizing logic, and composer-level pause/resume controls.
- Inline task logs are rendered through `frontend/src/components/chat/TaskConversationItem.tsx`, which currently embeds `TaskLogViewer` under each task card and keeps a local `logsExpanded` state.
- The frontend task API module still exposes `pauseTask` and `resumeTask` in `frontend/src/api/tasks.ts`.
- Frontend task/task-group types still include pause-related fields such as `TaskStatusStats.paused` and empty-log messaging for paused tasks in `frontend/src/api/types/tasks.ts`.
- The right-side workspace today is preview-focused inside `TaskGroupChatPage.tsx`; no browser-style mixed preview/log tab model exists yet.
- Backend task execution still treats `paused` as a real status in `backend/src/modules/tasks/task-runner.service.ts` and polls task status to abort running work when a task becomes paused or deleted.
- Backend task-group data is served from `backend/src/modules/tasks/task-groups.controller.ts`, while task actions and log paging live in `backend/src/modules/tasks/tasks.controller.ts` and `backend/src/modules/tasks/task-logs.service.ts`.

## Research Findings Update: 2026-03-06 17:09 CST
{/* Record the data-model and payload conclusions before implementation. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- `backend/src/modules/tasks/task-groups.controller.ts` already sanitizes `GET /task-groups/:id/tasks` with `canViewLogs: false` and `includeOutputText: false`, so the initial task-group list payload does not include log lines.
- `backend/src/modules/tasks/task.service.ts` also strips logs and trims `result_json` in list queries, so the current payload issue is mainly frontend-side eager detail fetching through `fetchTask(task.id)` inside `TaskGroupChatPage.tsx`.
- `backend/src/modules/tasks/task.service.ts` returns group tasks in `created_at DESC` order only; there is no explicit queue-link or ordering field yet.
- `backend/prisma/schema.prisma` shows the `Task` table has no sequence/link columns today, which means queue connectors and reorder actions will need schema changes or a derived ordering model.
- Pause/resume is still a first-class task lifecycle state in `frontend/src/api/types/common.ts`, `frontend/src/api/tasks.ts`, `backend/src/types/task.ts`, `backend/src/modules/tasks/tasks.controller.ts`, and `backend/src/modules/tasks/task-runner.service.ts`.
- `TaskGroupChatPage.tsx` eagerly fetches every terminal task detail to render outputs, which conflicts with the new requirement to keep initial task-group requests lightweight and open logs on demand.

## Technical Decisions Update: 2026-03-06 17:25 CST
{/* Record the selected implementation approach before code changes begin. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
| Decision | Rationale |
|----------|-----------|
| Add a persistent per-group order field and derive previous/next task links from it. | Reordering queued tasks cannot rely on `created_at`, and the UI needs stable connector metadata. |
| Implement stop as a manual-stop failure instead of a resumable paused state. | The new product flow removes resume and treats user-initiated stops as terminal failures. |
| Fetch task details and logs only when opening a workspace log tab. | This matches the requirement to keep initial task-group loads free of log payload expansion. |

## Requirements Update: 2026-03-06 17:31 CST
{/* Record the confirmed no-compatibility constraint from the user before refactoring state models. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- The user explicitly confirmed that backward compatibility is not required because the project is still early-stage.
- We can remove old pause/resume state handling directly instead of carrying compatibility shims.

## Delivery Findings
- Backend queue order now persists via `group_order`, so queued-task reordering no longer relies on timestamps.
- The TaskGroup page can keep preview and multiple task-log tabs open together by sharing one right-side workspace pane.
- Task detail/log payloads remain out of the initial task-group fetch and are loaded only after a task log tab opens.
- Full backend and frontend test suites passed after removing pause/resume expectations from the updated coverage.


## Frontend Structure Findings Update: 2026-03-06 20:20 CST
{/* Record the right-side workspace extraction follow-up so later cleanup can reuse the same module boundaries. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- The right-side preview surface in `TaskGroupChatPage.tsx` was still mixing three concerns: preview browser chrome, preview diagnostics/log rendering, and the workspace panel shell with tabs/divider.
- Extracting the preview surface into dedicated components is low-risk because existing tests assert visible labels and buttons rather than file-local implementation details.
- The remaining oversized responsibility in `TaskGroupChatPage.tsx` is now mostly preview state/effects and task-group data orchestration, not the browser-style UI markup itself.


## Runtime Findings Update: 2026-03-06 20:35 CST
{/* Record the runtime error findings so later refactors preserve the same hardening guarantees. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- The task-group card crash came from `statusTag()` assuming every runtime payload carried a known `TaskStatus` key, while real-world payloads can still be partial or carry legacy states during active refactors.
- The task-group page also surfaced current Ant Design API deprecations through `destroyTooltipOnHide` and `Space direction`, so the workspace now uses `destroyOnHidden` and `orientation` on the affected path.

## Runtime API Findings — 2026-03-06 21:10 CST
{/* Capture the concrete API responses observed during the post-refactor runtime debug pass. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- PAT-authenticated debugging against `/api/task-groups/dbb01b3a-aa23-49e8-9224-47b262ac9f76/preview/status` showed the browser noise was caused by a backend `409 Conflict` payload with `code: "workspace_missing"`, even though the page only needed an unavailable preview snapshot.
- PAT-authenticated debugging against `/api/dashboard/sidebar?tasksLimit=3&taskGroupsLimit=50` returned `200 OK`, so the visible sidebar problem on the page was dominated by repeated background polling noise rather than a reproducible contract failure for the current account used by the PAT debug script.
- The remaining Ant Design `Space.direction` warning on the task-group/task-detail route came from `TaskGitStatusPanel`, which is rendered by both queue cards and the right-side task log panel.


## Workspace Cleanup Findings — 2026-03-06 21:42 CST
{/* Capture the remaining cleanup conclusions after the preview split so the next pass starts from concrete evidence. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- `TaskGroupChatPage.tsx` still mixed group/task fetching, optimistic send flow, SSE polling, and UI composition after the preview workspace extraction, which made it the next best candidate for a hook split.
- The composer skill mode in task-group workspaces was not loading automatically because `fetchTaskGroupSkillSelection()` only ran from the modal refresh action; the page therefore showed a perpetual loading hint until manual intervention.
- `taskLogsEnabled` was a dead prop for the refactored task-group workspace: `AppShell`, `TaskGroupChatPage`, and the page test helper still threaded it through even though the workspace no longer consumed it.
- After this cleanup pass, the main remaining low-risk optimization targets are still inside `frontend/src/pages/taskGroupChatPage/useTaskGroupPreviewWorkspace.tsx` (956 lines), especially the preview bridge state, preview log stream wiring, and preview panel layout math.
- This follow-up also confirmed two more easy preview cleanups: `previewBridgeReady` can stay ref-only, and `previewAddressMeta` only needs `isSecure` for the browser chrome.

## Card Header Follow-up — 2026-03-06 22:13 CST
{/* Capture the task-card header overflow issue discovered after the workspace refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Long task titles in the queue card header could still compress the order pill and status tags because the header row did not let the title area shrink independently from the badge area.


## Workspace Detail Polish — 2026-03-06 22:22 CST
{/* Capture the final detail-level UI issues discovered after the main task-group workspace refactor. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Queue-card task bodies and execution summaries were still degrading Markdown into plain text, which dropped line breaks, headings, and code/list formatting.
- Workspace log-tab output also needed Markdown rendering so backend-generated result text stays readable when it contains structured content.
- Compact git-status cards inside task cards were still bubbling clicks into the parent task card, which opened the right-side log tab while users were only trying to expand git details.
- The compact git-status details also looked left-biased inside wide cards until the git panel itself was centered.
- The preview workspace still honored a remembered localStorage width; the new requirement is to reopen wide-screen right panels at a clean 50% split by default.

## Research Findings Update: 2026-03-06 22:40 CST
{/* Capture the root cause and remaining edge cases for the homepage-created task-group stale status report. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- `backend/src/modules/tasks/task.service.ts` moved tasks from `queued` to `processing` inside `takeNextQueued()` without publishing `task-group.refresh`, so a freshly opened task-group page could miss the first status transition completely.
- `frontend/src/pages/taskGroupChatPage/useTaskGroupWorkspaceData.ts` previously stopped polling as soon as the task-group SSE stream emitted `ready`, even when the visible task list still showed active queued work.
- `frontend/src/api/taskGroups.ts` fetches task-group tasks without a TTL cache, so the stale status was not caused by client-side cache reuse; only in-flight de-duplication applies.
- Remaining low-risk caveats: refresh requests in `mode: 'refreshing'` are skipped while another request is already in flight, the active-task polling heuristic only sees the first 50 loaded tasks, and empty SSE recipient lists still rely on the polling fallback.

## Research Findings Update: 2026-03-06 23:05 CST
{/* Capture the root cause behind processing tasks that ignored stop requests during workspace preparation. docs/en/developer/plans/taskgroup-ui-refactor-20260306/task_plan.md taskgroup-ui-refactor-20260306 */}
- Live inspection of `/task-groups/81e96b8b-471d-4a51-9496-1cf0b02fa203` showed the affected task is now `failed`, and its later paged logs confirm the run eventually completed after a forced retry instead of through the original stop request.
- The processing-task `stop` path only writes `result.stopRequestedAt` and relies on the task runner's `AbortController`; it does not directly flip `status` for running tasks.
- `backend/src/agent/agent.ts` sent the abort signal only into model-provider execution, while clone/pull/dependency shell commands still used `streamCommand -> runCommandWithLogs` without `AbortSignal` support.
- Because those shell commands were launched through `sh -c` without process-group termination, stopping a task during repository preparation or dependency installation could leave the task visibly stuck in `processing` until the command eventually returned or the user forced a retry.

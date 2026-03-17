# Findings & Decisions: Refactor worker file diff visibility into HookCode
{/* Link discoveries to code changes via this session hash. worker-file-diff-ui-20260316 */}

## Session Metadata
- **Session Hash:** worker-file-diff-ui-20260316
- **Created:** 2026-03-16

## Requirements
- Replace the old HookCode worker flow with a refactored worker-centric execution design; backward compatibility is not required.
- Let users inspect files changed by the active worker and view each file diff while the worker is still running.
- Surface the same changed-file/diff experience in both the task-group workspace and the task-detail page.
- Match the presentation style of ClaudeCodeUI's compact file header plus inline diff card layout.
- Limit the first implementation to repository-relative changes instead of whole-workspace snapshots.

## Research Findings
- `worker/src/runtime/taskExecution.ts` currently only resolves a command, streams stdout/stderr into task logs, and finalizes output text; it does not collect repository changes.
- `backend/src/modelProviders/codex.ts` already emits `item.* file_change` and `hookcode.file.diff` task-log events for Codex SDK runs, so HookCode already has a working event shape for file diffs.
- `frontend/src/components/execution/ExecutionTimeline.tsx` already renders file-change items and inline diffs, and `frontend/src/components/diff/DiffView.tsx` is the current lightweight diff renderer.
- `frontend/src/components/taskGroupWorkspace/TaskGroupLogPanel.tsx` and `frontend/src/pages/TaskDetailPage.tsx` are the existing task inspection surfaces that can host a new dedicated workspace-changes panel.
- `backend/src/types/task.ts` currently persists `gitStatus` but not file-level workspace diffs, so reload-safe diff history requires a new task-result field.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Introduce a worker-side repository change tracker instead of deriving UI data only from provider-specific events | The feature must work for the refactored worker execution path, not only for Codex SDK tasks. |
| Persist a normalized `workspaceChanges` snapshot in `TaskResult` while continuing to stream diff events into task logs | SSE logs provide live updates, and persisted result data provides refresh/history continuity. |
| Reuse HookCode's existing diff/timeline primitives but add a dedicated `TaskWorkspaceChangesPanel` with ClaudeCodeUI-inspired chrome | This minimizes rendering risk while giving the user a primary file/diff UI instead of burying diffs inside the timeline. |
| Keep `gitStatus` focused on branch/push metadata and move file-level diff ownership to `workspaceChanges` | The existing `gitStatus` model is branch-centric and not suitable as the main file diff API. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| The repo's planning template duplicated sections in `findings.md` | Replaced the generated file with a clean session-specific findings document before implementation. |
| Raw `git diff --no-index` commands for created/deleted files do not behave symmetrically | Validated against a real temp repo, then used repo-relative no-index diffs for creates and `git diff HEAD -- <path>` for deletes in both trackers. |

## Resources
- `worker/src/runtime/taskExecution.ts`
- `backend/src/modelProviders/codex.ts`
- `backend/src/types/task.ts`
- `frontend/src/components/execution/ExecutionTimeline.tsx`
- `frontend/src/components/taskGroupWorkspace/TaskGroupLogPanel.tsx`
- `frontend/src/pages/TaskDetailPage.tsx`
- `claudecodeui/src/components/chat/tools/components/ToolDiffViewer.tsx`

## Visual/Browser Findings
- ClaudeCodeUI's `ToolDiffViewer` uses a compact bordered card, a monospace filename header, a small right-aligned badge, and dense +/- line rows. That structure maps cleanly to HookCode's task inspection panels without needing a full editor embed.

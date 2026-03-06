# Findings & Decisions: Modernize task group task card UI

## Session Metadata
- **Session Hash:** task-group-card-modernize-20260306
- **Created:** 2026-03-06

## Requirements
- Refactor the task card on task group page when tasks exist.
- Show richer and more useful task information.
- Improve visual quality to a modern UI style.
- Preserve current functional correctness while upgrading presentation.

## Research Findings
- Session planning files were initialized under `docs/en/developer/plans/task-group-card-modernize-20260306/`.
- Navigation sync in init script failed due to `docs.json` schema mismatch, but planning files were still created successfully.
- Frontend list page candidate located in `frontend/src/pages/TaskGroupsPage.tsx`, which already renders `hc-taskgroup-card` cards in a grid.
- Task-centric card candidate also appears in `frontend/src/components/chat/TaskConversationItem.tsx` (`hc-chat-task-card`) and may represent the card shown when task groups contain tasks.
- Confirmed `frontend/src/pages/TaskGroupsPage.tsx` renders task-group list cards (group-level metadata), not per-task cards.
- Confirmed `frontend/src/components/chat/TaskConversationItem.tsx` renders the per-task card in task-group chat timeline and currently shows only title + status + open-task link.
- Styling for the per-task card is defined in `frontend/src/styles/chat-timeline.css` via `.hc-chat-task-card`.
- `Task` type already provides rich metadata that can be surfaced without backend changes (event type, repo/robot summaries, queue diagnosis, timestamps, token usage, and git status summary in `result.gitStatus`).
- Existing shared helpers can be reused for card enrichment: `eventTag`, `queuedHintText`, `getTaskEventMarker`, and `getTaskRepoName` from `frontend/src/utils/task/*`.
- Reusing these helpers avoids duplicating event/status/queue parsing logic and keeps labels consistent with other UI modules.
- `.hc-chat-task-card` and timeline layout styles live in `frontend/src/styles/chat-timeline.css`; this is the correct place for visual modernization.
- Existing i18n structure separates chat-specific keys into `frontend/src/i18n/messages/en-US/chat.ts` and `frontend/src/i18n/messages/zh-CN/chat.ts`; new task-card labels should be added there.
- Existing task-group chat tests (`taskGroupChatPage.timeline.test.tsx`, `taskGroupChatPage.composer.test.tsx`) cover timeline behavior but do not currently assert enriched task-card metadata.
- Adding assertions in `taskGroupChatPage.timeline.test.tsx` is the most direct way to protect the redesigned task card UI.
- `chat.ts` already hosts chat-level task message labels; new task-card field labels and fallbacks should be colocated there for i18n consistency.
- Shared test helper `taskGroupChatPageTestUtils.tsx` makes it straightforward to inject richer task fixtures in timeline tests without adding new mock infrastructure.
- Existing utility `formatDateTime` in `frontend/src/utils/dateUtc.ts` can be reused to format task card timestamps consistently.
- `TaskDetailPage` already contains a robust token-usage normalization pattern that can be adapted for the task card summary row.
- Design tokens are centralized in `frontend/src/styles/tokens.css`, and card modernization patterns exist in `frontend/src/styles/cards.css` (`.hc-modern-card*` classes).
- Chat timeline styles should consume existing semantic variables (`--hc-surface`, `--hc-border`, `--hc-accent-soft`, `--hc-shadow-*`) for theme consistency.
- `TaskDetailPage` currently normalizes `result.tokenUsage` inline; this logic can be extracted into `frontend/src/utils/task/result.ts` and reused by the chat task card.
- `TaskConversationItem` receives both summary (`task`) and optional detailed payload (`taskDetail`), so enriched fields should prefer `mergedTask = taskDetail ?? task`.
- Implemented task card enrichment in `TaskConversationItem` with existing helpers (`eventTag`, `getTaskEventMarker`, `getTaskRepoName`, `queuedHintText`, `formatDateTime`).
- Added shared helper `extractTaskTokenUsage` in `frontend/src/utils/task/result.ts` and reused it in both `TaskConversationItem` and `TaskDetailPage`.
- Added timeline test coverage for enriched card metadata in `frontend/src/tests/taskGroupChatPage.timeline.test.tsx`.
- Full frontend test suite still reports two existing timeline failures related to chained log-stream expectations (`taskGroupChatPage.timeline.test.tsx`).

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Prioritize frontend architecture and data mapping discovery before proposing fields to display. | Useful card redesign depends on exact available task entity fields and existing page composition. |
| Keep redesign frontend-only unless discovery reveals missing backend fields. | Existing `Task` payload already includes multiple high-signal fields for richer cards. |
| Reuse shared utilities (`formatDateTime`, task helper functions) instead of introducing duplicate formatters. | Keeps behavior consistent and follows project requirement to avoid utility duplication. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` non-zero exit due to docs navigation sync assumption. | Kept generated plan files and continued with manual planning updates. |

## Resources
- `.codex/skills/file-context-planning/SKILL.md`
- `docs/en/developer/plans/task-group-card-modernize-20260306/task_plan.md`
- `docs/en/developer/plans/task-group-card-modernize-20260306/progress.md`
- `frontend/src/pages/TaskGroupChatPage.tsx`
- `frontend/src/components/chat/TaskConversationItem.tsx`
- `frontend/src/styles/chat-timeline.css`
- `frontend/src/api/types/tasks.ts`
- `frontend/src/utils/task/status.tsx`
- `frontend/src/utils/task/labels.tsx`
- `frontend/src/utils/task/queue.ts`
- `frontend/src/i18n/messages/en-US/chat.ts`
- `frontend/src/i18n/messages/zh-CN/chat.ts`
- `frontend/src/tests/taskGroupChatPage.timeline.test.tsx`
- `frontend/src/tests/taskGroupChatPage.composer.test.tsx`

## Visual/Browser Findings
- No image/browser findings yet.

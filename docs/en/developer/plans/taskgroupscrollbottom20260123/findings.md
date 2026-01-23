# Findings & Decisions: Task group auto-scroll to bottom after async logs

{/* Link discoveries to code changes via this session hash. taskgroupscrollbottom20260123 */}

## Session Metadata
- **Session Hash:** taskgroupscrollbottom20260123
- **Created:** 2026-01-23

## Requirements
- When entering a task-group page, async log loading should not leave the scroll position above the bottom if the user hasn't scrolled away.

## Research Findings
- Task-group chat scroll logic lives in `frontend/src/pages/TaskGroupChatPage.tsx` with refs `chatAutoScrollEnabledRef`, `chatDidInitScrollRef`, and a `useLayoutEffect` that scrolls to bottom only when tasks or paging state change.
- `TaskLogViewer` already attempts to pin the nearest scroll container to bottom on log updates, but async log rendering can still change height after the chat page's initial bottom scroll.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Use `ResizeObserver` on the chat body to detect async height changes | Keeps the chat pinned to bottom without relying on log components to signal updates. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- frontend/src/pages/TaskGroupChatPage.tsx
- frontend/src/components/TaskLogViewer.tsx
- frontend/src/components/chat/TaskConversationItem.tsx
- frontend/src/styles.css

## Visual/Browser Findings
- None.

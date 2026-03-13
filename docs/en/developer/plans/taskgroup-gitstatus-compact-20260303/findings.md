# Findings & Decisions: Compact git status card in task group dialog

{/* Capture discovery and decisions for compact-by-default git status rendering. docs/en/developer/plans/taskgroup-gitstatus-compact-20260303/task_plan.md taskgroup-gitstatus-compact-20260303 */}
## Session Metadata
- **Session Hash:** taskgroup-gitstatus-compact-20260303
- **Created:** 2026-03-03

## Requirements
- The git status dialog/card shown at the end of task-group conversation items currently occupies too much space.
- Default state should become a smaller compact box.
- Compact box must show key information.
- Users must be able to click and expand to view detailed content.

## Research Findings
- `frontend/src/components/chat/TaskConversationItem.tsx` renders `TaskGitStatusPanel` at the bottom of each task conversation item.
- `frontend/src/components/tasks/TaskGitStatusPanel.tsx` is the central component for git status rendering and already has a `variant="compact"` mode used by conversation items.
- `frontend/src/styles/chat-timeline.css` contains task-group chat git status card sizing and spacing styles (`.hc-chat-git-status`).
- The active `.hc-chat-git-status` CSS rule is currently in `frontend/src/styles/chat-timeline.css`, not `chat-layout.css`.
- Existing change log indicates recent git status UI redesign (`ui-improve-20260302`), so this task should refine interaction without undoing style improvements.
- `TaskGitStatusPanel` currently always renders detailed sections (status tags, info grid, file lists) even in `compact` variant, which explains the excessive height in task-group chat.
- Current compact mode only limits file list preview to 3 entries per section but still shows all structural blocks, so default collapsed behavior needs a dedicated interaction state.
- i18n currently has git status labels for title/status/files but no explicit expand/collapse action text keys, so this change should add them.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Implement collapse/expand behavior inside `TaskGitStatusPanel` when `variant === 'compact'` | Limits surface area of changes and preserves existing integration points. |
| Keep full details visible by default for non-compact contexts | Avoid regression for pages where full status is expected (e.g., task detail). |
| Show branch + ahead/behind + staged/changed/untracked counters in compact summary | Provides high-signal status while minimizing occupied space. |
| Keep one expand/collapse control by using the summary row as the only trigger | Prevents duplicate “Show details” actions and keeps click target large. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Planning init script returned docs navigation error | Logged in plan/progress; continued because required session files were created. |
| User-reported duplicate “Show details” entries after first implementation | Removed card-header toggle and kept only summary-row toggle in compact mode. |
| Component test selector failed due full accessible-name matching | Updated role query to regex (`/show details/i`) for robust accessibility assertions. |

## Resources
- `frontend/src/components/chat/TaskConversationItem.tsx`
- `frontend/src/components/tasks/TaskGitStatusPanel.tsx`
- `frontend/src/styles/chat-timeline.css`
- `frontend/src/tests/taskGitStatusPanel.test.tsx`

## Visual/Browser Findings
- N/A (no browser/image session used).

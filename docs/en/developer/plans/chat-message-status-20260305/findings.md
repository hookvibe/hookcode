# Findings & Decisions: Hide non-error message status label
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. chat-message-status-20260305 */}

## Session Metadata
- **Session Hash:** chat-message-status-20260305
- **Created:** 2026-03-05

## Requirements
{/* Captured from user request */}
- In the task-group chat UI, each message currently shows a status label in the top-right corner (for example "完成", "已退出").
- Remove/hide the status label for non-failure outcomes (completed/exited/success).
- Keep showing a status label when the message has failed (failure/error).

## Research Findings
{/* Key discoveries during exploration */}
- Planning workflow is enforced by repo `AGENTS.md`; code changes must include an English traceability inline comment linking back to this session plan.
- The per-"message" status text in the task-group conversation log stream is rendered by `frontend/src/components/execution/ExecutionTimeline.tsx` as `.chat-bubble__status` in the bubble header.
- Task-group chat renders the dialog-style logs via `TaskConversationItem` → `TaskLogViewer` (`variant="flat"`) → `TaskLogViewerFlat` → `ExecutionTimeline`, so changing `ExecutionTimeline` impacts the visible UI in task groups.
- Preview highlight validation can target the `frontend` preview instance and navigate to `/#/task-groups/<id>` before selecting `.chat-bubble__header` / `.chat-bubble__status.is-failed`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Render message status badge only when status is a failure state. | Matches user request and reduces visual noise for successful messages. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` reported `docs.json missing navigation.languages[]`. | Proceeded since plan files were created; will keep the plan discoverable via `docs/en/developer/plans/index.md`. |

## Resources
- `docs/en/developer/plans/chat-message-status-20260305/task_plan.md` (source of truth for phases and decisions)
- `frontend/src/components/execution/ExecutionTimeline.tsx` (status badge rendering)
- `frontend/src/components/chat/TaskConversationItem.tsx` (task-group chat item composition)
- `.codex/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs` (UI highlight tool)

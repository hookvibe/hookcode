# Findings & Decisions: Task detail layout horizontal tabs




## Session Metadata
- **Session Hash:** taskdetailui20260121
- **Created:** 2026-01-22

## Requirements


- Task detail page: change the 4 content blocks (Webhook raw content / Prompt snippet / Realtime logs / Execution result) from vertical stacking to a top horizontal tab switcher.
- Step bar: the switcher is at the top and looks like a steps/progress bar; when one step is active only that section is visible, others are hidden (Result is leftmost).
- Scrolling: remove per-section scroll containers; content should expand naturally and be scrollable by the page.
- Realtime logs: remove toolbar/buttons (pause/reconnect/raw/copy/clear); default to the structured view; remove the "wrapped" log panel so logs are flat on the page.

## Research Findings


- `frontend/src/pages/TaskDetailPage.tsx` renders the 4 sections via Ant Design `Steps` (`workflowSteps`) in the right pane.
- The "Webhook raw" and "Prompt snippets" panels render `<pre className="hc-task-code-block">` which enforces `max-height: 360px; overflow: auto;` in `frontend/src/styles.css`.
- The "Realtime logs" panel uses `frontend/src/components/TaskLogViewer.tsx` with a fixed `height` prop and a built-in toolbar (pause/reconnect/raw/copy/clear).

## Technical Decisions


| Decision | Rationale |
|----------|-----------|
| Use Ant Design `Steps` (horizontal) as a sticky switcher for the 4 panels | Matches the requested step-bar look and keeps the switcher visible while scrolling |
| Add `variant="flat"` to `TaskLogViewer` for task detail usage | Removes the log toolbar and inner scroll while still reusing SSE + timeline parsing |
| Add `hc-task-code-block--expanded` for task detail `pre` blocks | Removes max-height/overflow so payload/prompt show fully on the page |

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

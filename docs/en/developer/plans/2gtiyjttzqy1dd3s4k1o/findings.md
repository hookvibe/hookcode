# Findings & Decisions: Preview layout adjustments
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. 2gtiyjttzqy1dd3s4k1o */}

## Session Metadata
- **Session Hash:** 2gtiyjttzqy1dd3s4k1o
- **Created:** 2026-02-04

## Requirements
{/* Captured from user request */}
- On wide desktop browsers, the preview view should default to half of the available width.
- On mobile, show a small floating preview window at the top of the screen.
- The “open new page” buttons must appear inside the mobile floating window so users can open the preview in a new page.

## Research Findings
{/* Key discoveries during exploration */}
- Pending codebase exploration to locate preview layout and responsive rules.

## Technical Decisions
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Default preview width to 50% (CSS + JS ratio). | Matches the requested half-width desktop default. |
| Apply inline preview widths only above 1024px. | Keeps mobile sizing controlled by CSS for the floating window. |
| Use CSS-only mobile floating styles. | Avoids new render branches while keeping the compact preview header/buttons visible. |

## Issues Encountered
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* URLs, file paths, API references */}
- docs/en/developer/plans/2gtiyjttzqy1dd3s4k1o/task_plan.md

## Visual/Browser Findings
{/* Multimodal content must be captured as text immediately */}
- None yet.

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## Update 1 (2026-02-04)
- Preview layout logic lives in `frontend/src/pages/TaskGroupChatPage.tsx`, including preview panel width defaults, resize handling, and a 1024px breakpoint for drag interactions.
- Preview styling is likely in `frontend/src/styles/chat-layout.css` and `frontend/src/styles/preview-logs.css` (based on search results).

## Update 2 (2026-02-04)
- Preview panel markup (header, browser toolbar, open/copy buttons, tabs, iframe) is in `frontend/src/pages/TaskGroupChatPage.tsx` around the `hc-preview-panel` markup.
- Default panel width in CSS is `width: 38%` in `frontend/src/styles/preview-shell.css`, and JS seeds width based on `PREVIEW_PANEL_DEFAULT_RATIO` in `frontend/src/pages/TaskGroupChatPage.tsx`.
- The open-new-page button uses the header actions area (`hc-preview-header-actions`) with `preview.action.openWindow` tooltip.

## Update 3 (2026-02-04)
- Responsive preview layout is handled in `frontend/src/styles/preview-logs.css` with a 1024px breakpoint that stacks chat/preview and makes the preview panel full width.
- There is no existing mobile floating preview styling; mobile currently renders the preview panel in the normal flow.

## Update 4 (2026-02-04)
- `frontend/src/pages/TaskGroupChatPage.tsx` sets `PREVIEW_PANEL_DEFAULT_RATIO = 0.38` and uses it to seed the preview width; minimum width is 320px with a min chat width of 420px.

## Update 5 (2026-02-04)
- Preview width is applied via `previewPanelStyle` in `frontend/src/pages/TaskGroupChatPage.tsx`, which sets an inline `width` when `previewPanelWidth` is available.
- The preview panel lives inside `.hc-chat-layout` alongside `.hc-chat-panel`; layout uses flex row by default and switches to column at 1024px in CSS.

## Update 6 (2026-02-04)
- There is no `useMediaQuery` hook in the frontend; responsive logic is handled via CSS and occasional `window.matchMedia` checks (e.g., in `AppShell.tsx`).

## Update 7 (2026-02-04)
- `.hc-page` uses flex column with `height: 100%`, but scrolling is handled inside nested panels (e.g., chat body). No existing mobile floating preview rules in page layout.

## Update 8 (2026-02-04)
- `frontend/src/pages/AppShell.tsx` already manages responsive state with `window.matchMedia` and `MediaQueryList` listeners, which can be mirrored if we need JS-driven layout changes for the preview panel.

## Update 9 (2026-02-04)
- Frontend tests run via `pnpm --filter hookcode-frontend test` (script delegates to `node ./scripts/run-vitest.cjs`).
- Root `pnpm test` runs backend and frontend tests sequentially.

## Update 10 (2026-02-04)
- Updated TaskGroupChatPage preview sizing logic, preview styles, and added a preview width test; planning session files added under docs/en/developer/plans/2gtiyjttzqy1dd3s4k1o/.

## Update 11 (2026-02-04)
- Verified TaskGroupChatPage preview sizing logic and mobile CSS additions in diffs; changes align with the new half-width desktop default and compact mobile panel styles.

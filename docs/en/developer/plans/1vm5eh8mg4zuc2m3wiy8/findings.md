# Findings & Decisions: Preview indicator + auto-stop

{/* Link discoveries to code changes via this session hash. 1vm5eh8mg4zuc2m3wiy8 */}

## Session Metadata
- **Session Hash:** 1vm5eh8mg4zuc2m3wiy8
- **Created:** 2026-02-04

## Requirements
- Show a small indicator dot on the task group entry in the left sidebar when preview is running.
- If preview is hidden for 30 minutes, automatically stop preview and reclaim the port.
- On wide screens, default the preview panel to half width; on mobile, show a compact preview window at the top with open-in-new-page actions visible.
- Replace the composer time-window icon with a multi-action popover that includes preview start, and auto-start preview after dependency installs.
- Move the preview instance label (e.g., "app") beneath the address bar and refine the toolbar layout around the address input.

## Research Findings
- TaskGroup chat UI and preview panel rendering live in `frontend/src/pages/TaskGroupChatPage.tsx`.
- Preview panel responsive behavior is styled in `frontend/src/styles/preview-logs.css` (mobile top placement) and `frontend/src/styles/preview-shell.css` (default width + chrome).
- Sidebar task group labels are rendered in `frontend/src/pages/AppShell.tsx` via `groupMenuItems` and the dashboard sidebar snapshot.
- Preview lifecycle and idle timeout logic live in `backend/src/modules/tasks/preview.service.ts`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md

## Visual/Browser Findings
- None.

## Update 1 (2026-02-04)
- Sidebar task group items are rendered in `frontend/src/pages/AppShell.tsx` via `groupMenuItems` and the `Menu` in the task group section.
- Sidebar data comes from `/dashboard/sidebar` via `fetchDashboardSidebar`, which returns `taskGroups` in the snapshot.
- Preview lifecycle and idle timeout logic lives in `backend/src/modules/tasks/preview.service.ts` (idle stop already exists via `stopIdlePreviews`).

## Update 2 (2026-02-04)
- Preview layout adjustments (half-width on desktop, compact top panel on mobile) are handled via preview panel sizing state + responsive CSS.
- Composer actions popover now wraps time-window controls and a preview start shortcut; preview reinstall auto-start can reuse the same start modal logic.
- Backend/Frontend coordinate hidden preview shutdown via a `preview/visibility` endpoint and client visibility events.

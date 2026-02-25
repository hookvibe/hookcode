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

## Update 3 (2026-02-05)
- Modern sidebar task group rows are missing the preview-active dot despite `previewActive` being exposed in the API.
- Sidebar tests currently assert that preview dots are not rendered; they must be updated once the indicator is restored.
- User reports the preview-active indicator dot in the left task-group menu is still missing in the current build.
- User reports the “hidden for 30 minutes” auto-stop + port reclaim behavior is not implemented or not working.
- ModernSidebar already renders a preview-active dot in task-group rows when `previewActive` is true (non-collapsed view), with styling in `frontend/src/styles/modern-sidebar.css`.
- Backend task-group endpoints already decorate payloads with `previewActive` from PreviewService (`task-groups.controller.ts`, `dashboard.controller.ts`).
- Preview visibility reporting exists: frontend posts `/task-groups/:id/preview/visibility`, and backend has a controller + DTO + PreviewService hidden timers to stop after a timeout.
- Frontend currently reports visibility based on `document.visibilityState` and `pagehide`, which may not reflect the preview panel hide/show state.
- PreviewService `getActiveTaskGroupIds` marks groups active when any instance is `running` or `starting`, so sidebar dots depend on runtime group state.
- `stopPreview` clears hidden timers, stops instances, releases ports, and removes the task group runtime from the PreviewService map.
- AppShell always renders `ModernSidebar` (desktop + mobile drawer), so preview dot issues should be inside ModernSidebar data flow or backend payloads rather than legacy sidebar components.
- ModernSidebar loads task groups via `fetchDashboardSidebar` and renders dots based on `taskGroups` from that snapshot; previewActive depends on that backend payload and refresh cadence.
- `fetchDashboardSidebar` uses a cached `/dashboard/sidebar` snapshot with a 3000ms TTL, so previewActive updates may lag but should refresh within a few seconds.
- Preview visibility endpoint delegates to `previewService.markPreviewVisibility(id, visible)`, so hidden auto-stop depends on that method being called and wired to UI hide events.
- `markPreviewVisibility` only toggles hidden timers when the backend is notified; it does nothing if the preview group isn't running, so UI must report visibility changes to trigger 30-minute auto-stop.
- `previewPanelOpen` is computed from preview availability and aggregate status (not a direct user-hide toggle), so visibility reporting only runs while preview is running/starting.
- The modern sidebar is the only sidebar component used; `DashboardSidebarSnapshot` already types `taskGroups` as `TaskGroup[]`, which can carry `previewActive`.
- Preview hidden timeout constant is already set to 30 minutes (`PREVIEW_HIDDEN_TIMEOUT_MS = 30 * 60 * 1000`).
- Theme tokens define `--accent` as black in light mode and white in dark mode; the sidebar dot uses `--accent` with a `--hc-sider-bg` outline.
- TaskGroupsPage fetches task groups but does not display `previewActive` state; sidebar remains the primary location for the preview-active indicator.
- Progress log already contains a 2026-02-05 session entry marking previous preview indicator work as complete; new follow-up notes should extend that section.
- Sidebar polling runs every 10s while active, so previewActive indicators may lag unless caches are invalidated on preview start/stop.
- `HookcodeConfig` requires `version: 1` with optional `preview.instances`, so tests can stub a minimal config with a single preview instance.
- Root `pnpm test` runs `pnpm --filter hookcode-backend test` and `pnpm --filter hookcode-frontend test`.

# Findings & Decisions: Add preview management dashboards for repo and admin
<!-- Persist architecture findings for preview management dashboards. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 -->

## Session Metadata
- **Session Hash:** preview-management-dashboard-20260303
- **Created:** 2026-03-03

## Requirements
- Repo detail page must show task groups that currently have preview running for that repository.
- Admin panel must show all running preview task groups across repositories.
- Admin panel must show preview port allocation status.

## Research Findings
- Existing preview lifecycle is managed by `backend/src/modules/tasks/preview.service.ts` with in-memory runtime map keyed by task group.
- Existing repo detail API already exposes preview config availability but not runtime task-group status.
- Existing frontend TaskGroup page already consumes per-group preview status endpoints.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Extend existing preview module APIs with read-only management snapshot endpoints | Keeps data source single and consistent with current runtime tracking |
| Implement admin overview under a non-proxy namespace (`/preview-admin/overview`) | Prevents route ambiguity with `/preview/*` proxy endpoints |
| Resolve repo preview runtime groups from the in-memory preview runtime map (`PreviewService.groups`) | Exposes true running state without adding DB writes for volatile process status |
| Fix aggregate preview status by prioritizing `running` before `starting` | Prevents stop button lock when some instances are already running |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Session init script docs-nav sync error (`navigation.languages[]` missing) | Logged and continued with manual docs updates |

## Resources
- `backend/src/modules/tasks/preview.service.ts`
- `backend/src/modules/repositories/repositories.controller.ts`
- `frontend/src/pages/RepoDetailPage.tsx`
- `frontend/src/pages/AdminToolsPage.tsx` (to verify admin surface)

## Visual/Browser Findings
- Not applicable; no browser/image workflow used.

## Discovery Log (2026-03-03)
- `TaskGroupChatPage` preview header button uses aggregate status logic that prioritizes `starting` over `running` when multiple preview instances exist.
- Current button loading state is tied to `previewAggregateStatus === 'starting'`, which can leave the stop button in a perpetual loading/disabled state if any instance remains `starting` while another instance is already `running`.
- Existing repo detail preview endpoint `GET /repos/:id/preview/config` currently exposes config discovery only (`available/reason/instances`) and does not expose running task groups.
- Existing admin surface is the settings page (`#/settings`) with admin-only tabs (`logs`); this is a practical place to add an admin preview management tab.
- Preview runtime ownership and port state are centralized in `PreviewService` + `PreviewPortPool`, so backend expansion should reuse these classes.

## Implementation Findings
- `PreviewPortPool` can provide deterministic allocation snapshots without scanning processes again because it already owns `inUse` and `allocations`.
- Extending `GET /repos/:id/preview/config` with `activeTaskGroups` allows repo detail preview management without extra frontend requests.
- A dedicated admin endpoint (`GET /preview-admin/overview`) avoids route overlap with reverse proxy routes under `/preview/*`.
- The preview action lock bug is resolved by changing aggregate status priority to `running > starting` and limiting button loading to explicit action requests.

<!-- Document backend preview timeout root causes and .hookcode mitigation updates. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 -->
## Post-Delivery Runtime Finding (2026-03-03)
- Backend preview startup can still surface as `startup timeout` when the preview command uses `nest --watch` and the app fails during bootstrap.
- In this failure mode, the watcher process can stay alive while no service binds the assigned preview port, so preview readiness never succeeds.
- Two concrete trigger classes were observed during debugging:
  - Embedded admin tools fixed-port collisions across concurrent preview task groups (`EADDRINUSE`).
  - Backend bootstrap/runtime failures (for example transient database connection errors) while watch mode remains alive.
- Mitigation in `.hookcode.yml`:
  - `ADMIN_TOOLS_ENABLED` remains `false` for backend preview instances.
  - Backend preview command switched from `pnpm dev` to `pnpm exec nest start` to fail fast on startup errors instead of timing out.

<!-- Capture strict-compilation finding behind backend preview exited(1) failures. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 -->
## Post-Delivery Compile Finding (2026-03-03)
- Backend preview startup can fail fast with `exited (1)` when `nest start` compiles under strict TypeScript checks and detects implicit-any callback parameters.
- Reported failures were in `backend/src/modules/tasks/task.service.ts` at queue-diagnosis and daily-volume mappers (`TS7006: Parameter 'row' implicitly has an 'any' type`).
- Mitigation:
  - Added explicit callback parameter type for queue position rows.
  - Replaced `any[]` raw-query typing with a concrete `DailyVolumeRow` type and typed mapper callback.

# Findings & Decisions: Add preview management dashboards for repo and admin
{/* Persist architecture findings for preview management dashboards. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
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

{/* Document backend preview timeout root causes and .hookcode mitigation updates. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
## Post-Delivery Runtime Finding (2026-03-03)
- Backend preview startup can still surface as `startup timeout` when the preview command uses `nest --watch` and the app fails during bootstrap.
- In this failure mode, the watcher process can stay alive while no service binds the assigned preview port, so preview readiness never succeeds.
- Two concrete trigger classes were observed during debugging:
  - Embedded admin tools fixed-port collisions across concurrent preview task groups (`EADDRINUSE`).
  - Backend bootstrap/runtime failures (for example transient database connection errors) while watch mode remains alive.
- Mitigation in `.hookcode.yml`:
  - `ADMIN_TOOLS_ENABLED` remains `false` for backend preview instances.
  - Backend preview command switched from `pnpm dev` to `pnpm exec nest start` to fail fast on startup errors instead of timing out.

{/* Capture strict-compilation finding behind backend preview exited(1) failures. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
## Post-Delivery Compile Finding (2026-03-03)
- Backend preview startup can fail fast with `exited (1)` when `nest start` compiles under strict TypeScript checks and detects implicit-any callback parameters.
- Reported failures were in `backend/src/modules/tasks/task.service.ts` at queue-diagnosis and daily-volume mappers (`TS7006: Parameter 'row' implicitly has an 'any' type`).
- Mitigation:
  - Added explicit callback parameter type for queue position rows.
  - Replaced `any[]` raw-query typing with a concrete `DailyVolumeRow` type and typed mapper callback.

{/* Capture preview-environment Prisma generation requirement for Git-cloned workspaces. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
## Post-Delivery Environment Finding (2026-03-03)
- In fresh preview environments cloned from Git, backend startup can fail with `TS2305: Module "@prisma/client" has no exported member "Prisma"` when Prisma client generation is missing or incomplete.
- This is environment-dependent and may not reproduce in long-lived local workspaces where Prisma artifacts already exist.
- Mitigation in `.hookcode.yml` dependency install:
  - Force dev dependency installation with `pnpm install --frozen-lockfile --prod=false`.
  - Run `pnpm --dir backend run prisma:generate` before preview startup.
- Additional compile-hardening:
  - Added explicit mapper parameter typing in `tasks.controller.ts` to remove another `TS7006` startup blocker.

{/* Capture dependency-allowlist mismatch root cause for missing frontend/backend modules in preview workspaces. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
## Post-Delivery Dependency Validation Finding (2026-03-03)
- The dependency installer validates commands against an allowlist and blocks shell control chars (`&&`, `;`, `|`) plus unsupported flag formats.
- The previous install command (`pnpm install --frozen-lockfile --prod=false && ...`) was blocked, and because failure mode was `soft`, preview startup continued without `node_modules`.
- This directly explains frontend `react/jsx-dev-runtime` resolution failures and follow-up backend compile/runtime dependency failures.
- Mitigation:
  - Switch dependency command to allowlist-compatible `pnpm install --frozen-lockfile`.
  - Set dependency `failureMode` to `hard` so install failures stop preview immediately with a clear dependency error.
  - Move Prisma generation to backend preview startup command (`pnpm run prisma:generate && pnpm exec nest start`), which is not constrained by dependency command allowlist.
- Operational note:
  - Existing task-group workspaces keep a snapshot of repository files at task creation time, so older groups will not automatically pick up these config/code fixes unless the task group is recreated or refreshed.

{/* Document transient DB bootstrap resets seen in preview startup and the retry mitigation. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
## Post-Delivery Database Stability Finding (2026-03-03)
- Backend preview startup still failed for some task groups with transient Postgres transport errors (`ECONNRESET`) during `ensureSchema()` lock acquisition/migration bootstrap.
- The failure happened before HTTP bind, so preview surfaced `exited (1)` even though subsequent retries often succeed manually.
- Mitigation:
  - Added transient DB startup error classification (`ECONNRESET`, `ETIMEDOUT`, `ECONNREFUSED`, selected PostgreSQL interruption codes).
  - Added bounded retry in `ensureSchema()` with configurable attempts/delay envs:
    - `HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS` (default `3`, range `1..10`)
    - `HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS` (default `1000`, range `100..10000`)
  - Set preview backend defaults in `.hookcode.yml` to `HOOKCODE_DB_SCHEMA_RETRY_ATTEMPTS=5` and `HOOKCODE_DB_SCHEMA_RETRY_DELAY_MS=1500` for higher resilience in shared remote DB environments.
  - Kept non-transient schema errors fail-fast (checksum mismatch, migration logic errors) to avoid masking real migration problems.

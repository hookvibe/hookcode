# Task Plan: Add preview management dashboards for repo/admin + preview button state fix
{/* Expand this session scope to include preview management dashboards and the preview-starting UI state fix. docs/en/developer/plans/preview-management-dashboard-20260303/task_plan.md preview-management-dashboard-20260303 */}
## Session Metadata
- **Session Hash:** preview-management-dashboard-20260303
- **Created:** 2026-03-03

## Goal
Add backend and frontend support for preview management views so users can inspect running preview task groups per repository and administrators can inspect all running preview groups plus preview port allocation, while fixing the TaskGroup preview header button that can remain stuck in a starting/loading state.

## Current Phase
Phase 5 (complete, includes backend preview timeout hotfix follow-up on 2026-03-03)

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm requested scope for two surfaces (repo detail and admin panel)
- [x] Locate existing preview lifecycle data sources and pages
- [x] Record initial findings and constraints
- **Status:** complete

### Phase 2: API Design & Data Modeling
- [x] Define response DTOs for repo-scoped and global preview management snapshots
- [x] Define port-allocation summary shape and source of truth
- [x] Document design decisions and edge cases
- **Status:** complete

### Phase 3: Backend Implementation
- [x] Implement preview management query methods and API endpoints
- [x] Add system log writer entries for new management behavior
- [x] Add/adjust backend tests
- **Status:** complete

### Phase 4: Frontend Implementation
- [x] Add repo detail preview-task-group management section
- [x] Add admin panel preview overview page/section with port allocation status
- [x] Fix TaskGroup preview header aggregate status so running instances are not blocked by mixed starting states
- [x] Add/adjust frontend tests
- **Status:** complete

### Phase 5: Verification, Docs, and Delivery
- [x] Run targeted tests
- [x] Run full test suites after test changes
- [x] Update session docs and changelog, then summarize outcomes
- **Status:** complete

## Key Questions
1. Which existing service already tracks active preview runtimes and can expose group/instance/port data reliably?
2. How should repo detail query “current repo running previews” without expensive scans or breaking existing APIs?
3. Where should admin panel UI live in current navigation and permissions model?
4. How should mixed preview statuses (`running` + `starting`) map to a single action button state without disabling valid stop actions?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start by extending existing `PreviewService` and controllers instead of introducing a new service | Reuses existing runtime state and avoids duplicate process-tracking logic |
| Use an admin endpoint outside `/preview/*` (e.g., `/preview-admin/overview`) | Avoids conflict with preview reverse-proxy routing handled by `/preview/:taskGroupId/:instanceName` |
| Keep repository preview management data on `GET /repos/:id/preview/config` | Reuses existing repo detail API call path and avoids extra frontend fetch complexity |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]` | 1 | Treated as non-blocking; continued with manual session-doc updates |

## Notes
- Re-read this plan before changing API shapes or UI wiring.
- Keep traceability comments updated on every modified code block.

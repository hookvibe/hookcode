# Task Plan: Add admin log system
{/* Track code changes with this session hash for traceability. logs-audit-20260302 */}

## Session Metadata
- **Session Hash:** logs-audit-20260302
- **Created:** 2026-03-02

## Goal
Add an admin-only, categorized logging system with retention, SSE updates, and a settings-tab UI, plus enforce global logging for new features.

## Current Phase
{/* Mark task completion status for delivery wrap-up. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 */}
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define logging data model + API contracts
- [x] Decide module wiring and logging entry points
- [x] Update AGENTS.md logging rule
- **Status:** complete

### Phase 3: Implementation
- [x] Add Prisma model + migration
- [x] Build Logs module (service/controller/SSE)
- [x] Add LogWriterService helpers and instrument key flows
- [x] Add frontend logs tab + API wiring
- [x] Update docs and i18n
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Add backend unit tests for logs API and helpers
- [x] Add frontend tests for logs tab gating and rendering
- [x] Run full test suite
- [x] Document test results in progress.md
- **Status:** complete

### Phase 5: Delivery
{/* Marked changelog task completion. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 */}
- [x] Update changelog entry
- [x] Final review + summary
- **Status:** complete

## Key Questions
1. How are logs stored and queried? (Answer: new SystemLog table with cursor pagination.)
2. How to ensure all new features log consistently? (Answer: enforce LogWriterService helper usage + AGENTS.md rule.)
3. Where does the UI live? (Answer: new `#/settings/logs` tab, admin-only.)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Admin-only logs via RepoAccessService.isAdmin | Matches existing RBAC pattern and avoids leaking system data. |
| SSE via EventStreamService topic `logs` | Reuses current SSE infrastructure. |
| 30-day retention with periodic cleanup | Meets requirement and keeps DB size bounded. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed `docs.json` navigation.languages[] | 1 | Proceed with plan files; document issue in findings and continue. |

## Notes
- Re-read this plan before major decisions.
- Add required inline comments with plan path + session hash for every change.

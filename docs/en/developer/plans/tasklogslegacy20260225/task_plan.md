# Task Plan: Remove legacy task logs env toggle
<!-- Rename plan wording to avoid the legacy env name. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 -->
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. tasklogslegacy20260225 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** tasklogslegacy20260225
- **Created:** 2026-02-26

## Goal
Remove the legacy task logs env toggle so only `TASK_LOGS_DB_ENABLED` and `TASK_LOGS_VISIBLE_ENABLED` remain, and clean up all related logic, env examples, docs, and tests accordingly.

## Current Phase
<!-- Mark the plan complete after delivery updates. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 -->
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm all legacy task log toggle usages across backend, CI scripts, docs, and tests
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define the removal approach (code paths + docs + env cleanup)
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
<!-- Mark implementation completion for legacy toggle removal tasks. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 -->
- [x] Remove legacy env fallback logic in backend config
- [x] Update CI/env examples/docs to drop legacy toggle references
- [x] Update tests to validate only the new toggles
- **Status:** complete

### Phase 4: Testing & Verification
<!-- Mark test completion for the legacy toggle cleanup. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 -->
- [x] Run relevant tests or note if skipped
- [x] Document test results in progress.md
- **Status:** complete

<!-- Record delivery completion for the legacy toggle cleanup. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 -->
### Phase 5: Delivery
- [x] Update changelog entry
- [x] Summarize changes and follow-ups
- **Status:** complete

## Key Questions
1. Which files still reference the legacy task log toggle and need cleanup?
2. Do any tests or docs depend on legacy behavior that must be removed or rewritten?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Remove legacy fallback and keep only new toggles | Avoid confusion and enforce a single, explicit configuration path |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

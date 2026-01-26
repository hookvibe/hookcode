# Task Plan: Fix task group skeleton not hidden
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. taskgroup_skeleton_20260126 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** taskgroup_skeleton_20260126
- **Created:** 2026-01-26

## Goal
Fix the task group page so the skeleton loader reliably disappears after data is loaded and the content is shown.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Execute the plan step by step
- [x] Add required inline comments with plan link + hash
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
- [x] Review all output files
- [x] Update changelog entry
- [x] Deliver to user
- **Status:** complete

## Key Questions
1. Which component renders the task group skeleton and controls its loading state?
2. What conditions should hide the skeleton and show content (data fetch completion, empty state, error state)?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Gate the task-group skeleton with `group?.id === taskGroupId` readiness instead of raw loading state. | Prevent stale loading flags from hiding already-loaded content and keep scroll logic consistent. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `pnpm vitest frontend/src/tests/taskGroupChatPage.test.tsx` failed (command not found) | 1 | Retried from frontend workspace directory. |
| `pnpm -C frontend vitest src/tests/taskGroupChatPage.test.tsx` failed (`frontend` command not found) | 2 | Switched `workdir` to `frontend` and re-ran `pnpm vitest`. |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions
- Log ALL errors

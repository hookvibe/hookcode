# Task Plan: Fix worker stuck after unknown reasoning parameter error

## Session Metadata
- **Session Hash:** worker-stuck-reasoning-20260304
- **Created:** 2026-03-04

## Goal
Diagnose why worker stops processing tasks after `Unknown parameter: 'reasoning'`, implement a robust fix so task processing continues, and change stale-processing recovery defaults so no automatic processing timeout is applied unless explicitly configured.

## Current Phase
Phase 6

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm reported runtime symptom and affected code path
- [x] Capture constraints and expected behavior
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Root Cause Analysis
- [x] Locate where `reasoning` is attached to remote compact requests
- [x] Identify why worker appears stuck after this failure
- [x] Confirm if queue/runner loop exits or blocks
- **Status:** complete

### Phase 3: Implementation
- [x] Fix unsupported request parameter behavior
- [x] Ensure worker loop continues after task-level failures
- [x] Add/adjust inline traceability comments in changed areas
- [x] Add or update tests for regression coverage
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted tests
- [x] Run full test suite after adding tests
- [x] Record test results in progress.md
- **Status:** complete

### Phase 5: Delivery
- [x] Update plan/findings/progress docs
- [x] Update `docs/en/change-log/0.0.0.md`
- [x] Report root cause, fix, and validation details to user
- **Status:** complete

### Phase 6: Stale Timeout Policy Update
- [x] Confirm whether reported tasks failed due to stale-processing recovery
- [x] Change `PROCESSING_STALE_MS` default behavior to unlimited (disabled when unset)
- [x] Update stale-related worker/API/task logic to respect disabled mode
- [x] Add/adjust tests for stale timeout parsing/behavior
- [x] Update docs/changelog and report behavior changes to user
- **Status:** complete

## Key Questions
1. Which provider integration emits `Error running remote compact task` and why does it send `reasoning`?
2. Is the worker actually dead, blocked, or silently exiting after this error?
3. What minimal safe fallback logic prevents invalid params while preserving model behavior?
4. Should stale-processing auto-recovery be enabled by default or opt-in?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with code-path tracing before runtime assumptions | Need deterministic root cause for queue stall behavior |
| Use PAT API debug against production data before changing queue code | Needed to distinguish worker dead process vs task-level hang |
| Fix Codex provider error-path handling first instead of TaskRunner loop | Queue loop remains alive; the stuck processing task is blocked inside provider execution |
| Add compatibility fallback that retries without `modelReasoningEffort` | Upstream gateway rejects `reasoning`, and retry can recover without manual intervention |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]` | 1 | Continued because required session files were created successfully |
| PAT bulk query output was very large due full task logs | 1 | Switched to focused `/api/tasks/:id/logs?tail=...` checks for diagnosis |

## Notes
- Re-read this plan before major changes.
- Prioritize preventing worker stalls over cosmetic error handling.

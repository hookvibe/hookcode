# Task Plan: Fix automation disable timeWindow validation
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. automation-disable-20260204 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** automation-disable-20260204
- **Created:** 2026-02-04

## Goal
Fix automation disable requests so they no longer fail `timeWindow` validation, while keeping validation strict when automation is enabled.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent and failing flows (disable event/trigger)
- [x] Locate backend + frontend validation and payload shaping
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define validation rules for enabled vs. disabled automation
- [x] Decide payload normalization strategy (frontend/backend)
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Adjust backend validation to accept disable flows
- [x] Confirm frontend payload already omits undefined timeWindow
- [x] Add/adjust tests for both enable + disable scenarios
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run relevant tests (unit + integration if present)
- [x] Verify API behavior for disable + enable flows
- [x] Document test results in progress.md
- **Status:** complete

### Phase 5: Delivery
- [x] Update changelog entry
- [x] Summarize changes and next steps for user
- **Status:** complete

## Key Questions
1. Where is `timeWindow` validated for automation updates (backend DTO/validator, service logic, or database constraints)? (Answered: repo-automation.service validation)
2. What payload is sent when disabling events/triggers, and can we normalize it to avoid invalid `timeWindow`? (Answered: backend should accept null/undefined; frontend already omits undefined)
3. Are there similar endpoints that should share the same enable/disable validation rules? (Reviewed repo-robot/chat validation; no change needed)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Allow null/undefined timeWindow in automation validation | Matches "no time limit" semantics and prevents disable flows from failing |
| No frontend payload change | UI already omits undefined timeWindow; backend fix covers nulls from existing configs |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions
- Log ALL errors - they help avoid repetition

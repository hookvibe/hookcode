# Task Plan: Task input actions menu + preview auto-start
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. b0lmcv9gkmu76vryzkjt */}

## Session Metadata
- **Session Hash:** b0lmcv9gkmu76vryzkjt
- **Created:** 2026-02-04

## Goal
Add an actions popover to the task group composer timer button (timer as one option, plus a new preview start action) and auto-start preview after dependency installation completes.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define technical approach
- [x] Identify target files/components
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Update composer UI to use actions popover
- [x] Add preview start action in the popover
- [x] Auto-start preview after dependency install
- [x] Add/adjust tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify requirements and flows
- [x] Document test results in progress.md
- [x] Fix issues
- **Status:** complete

### Phase 5: Delivery
- [x] Review outputs
- [x] Update changelog entry
- [x] Deliver to user
- **Status:** complete

## Key Questions
1. Where is the composer timer button implemented in TaskGroupChatPage?
2. What existing preview start handlers/modal flows should be reused for the popover action?
3. Where is dependency reinstall completion handled, and how can we trigger preview start after success?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use a composer actions popover that embeds the existing TimeWindowPicker plus a preview-start button. | Keeps the timer feature visible while adding new actions without new page layout. |
| Centralize preview start logic in a shared helper for modal + auto-start use. | Avoids duplicated start/refresh flows and keeps error handling consistent. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Composer modal test matched multiple “Start preview” nodes | 1 | Scoped assertion to `.ant-modal-title` within the dialog. |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions

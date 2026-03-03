# Task Plan: Rewrite README command presentation

## Session Metadata
- **Session Hash:** readmecmd20260227
- **Created:** 2026-02-27

## Goal
Rewrite `README.md` and `README-zh-CN.md` quick-start sections so Docker and local-development commands are clearer, grouped by workflow, and easier to copy/paste.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm user intent: rewrite both README files with better command presentation
- [x] Review current Docker/local command sections in both README files
- [x] Capture constraints and related workflow expectations
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define a clearer command-first documentation structure
- [x] Keep English and Chinese sections aligned in content
- [x] Finalize exact section layout before editing
- **Status:** complete

### Phase 3: Implementation
- [x] Rewrite `README.md` quick-start command sections
- [x] Rewrite `README-zh-CN.md` quick-start command sections
- [x] Add required inline traceability comments in changed markdown areas
- **Status:** complete

### Phase 4: Verification
- [x] Re-read both README files for consistency and command correctness
- [x] Ensure Docker and local workflows are both clear and complete
- **Status:** complete

### Phase 5: Delivery
- [x] Update `progress.md` with actions and outcomes
- [x] Update `docs/en/change-log/0.0.0.md` with session hash + summary + plan link
- [x] Deliver concise summary to user
- **Status:** complete

## Key Questions
1. Which command groups are most useful for daily usage (start, logs, rebuild, stop)?
2. Should Docker behavior on source changes be explicitly documented? (Yes)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep README focus on command workflows instead of long paragraphs | Improves copy/paste usability and readability |
| Add explicit Docker “no hot reload” note | Prevents confusion when frontend/backend source changes are not reflected automatically |
| Keep EN/ZH sections structurally parallel | Reduces maintenance drift across languages |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Docker base image metadata fetch EOF from mirror | 1 | Diagnosed as registry/mirror connectivity issue; validated by successful manual `docker pull node:18-alpine` after retry |
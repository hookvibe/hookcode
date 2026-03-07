# Task Plan: Modernize task group task card UI

## Session Metadata
- **Session Hash:** task-group-card-modernize-20260306
- **Created:** 2026-03-06

## Goal
Refactor the task card shown on the task group page to present more actionable task information with a modern, clearer visual hierarchy while keeping existing behavior stable.

## Current Phase
Phase 5 - Complete

## Phases
### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Locate current task card implementation files
- [x] Capture baseline findings in `findings.md`
- **Status:** complete

### Phase 2: UI/UX Solution Design
- [x] Define information architecture for richer task card data
- [x] Define modern visual treatment consistent with current design system
- [x] Confirm whether backend/API changes are needed
- **Status:** complete

### Phase 3: Implementation
- [x] Implement task card refactor in frontend modules
- [x] Add/update inline traceability comments in all changed areas
- [x] Ensure meaningful system log writer usage if behavior changes require auditing
- **Status:** complete

### Phase 4: Tests & Verification
- [x] Add or update relevant tests for new card rendering behavior
- [x] Run targeted tests
- [x] Run full test suite after adding tests
- [x] Record results in `progress.md`
- **Status:** complete

### Phase 5: Docs & Delivery
- [x] Update session docs (`task_plan.md`, `findings.md`, `progress.md`) to complete
- [x] Update `docs/en/change-log/0.0.0.md` with session hash and plan link
- [x] Prepare concise delivery summary for the user
- **Status:** complete

## Key Questions
1. Which task metadata is already available in the task group page data model and can be surfaced immediately?
2. Which visual changes can be done without breaking existing responsive behavior and interactions?
3. Which tests currently guard task group card rendering, and what should be extended?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Start with frontend-only discovery first, then verify backend impact. | The user request is explicitly UI-focused; validating data availability avoids unnecessary backend changes. |
| Use new session hash `task-group-card-modernize-20260306`. | No active session hash exists in this conversation and task is new. |
| Redesign `TaskConversationItem` task card by surfacing event type, task id marker, repo/robot, queue hint, timing, and token usage. | These fields are already available on `Task` payloads and improve task triage without backend work. |
| Keep implementation frontend-only for this request. | Existing APIs already provide required data and no new backend behavior is introduced. |
| Reuse `extractTaskTokenUsage` in both task detail and task-group card modules. | Centralizing token parsing avoids duplicate normalization logic and keeps token labels consistent. |
| Skip new system-log writer entries for this change. | The scope is presentation-only frontend refactor and does not modify backend/runtime workflows that require audit logging. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` reported `docs.json missing navigation.languages[]` after file creation. | 1 | Proceeded because required planning files were successfully created; will avoid relying on docs auto-sync for this task. |

## Notes
- Re-read this plan before major implementation decisions.
- Keep findings updated at least every two discovery actions.

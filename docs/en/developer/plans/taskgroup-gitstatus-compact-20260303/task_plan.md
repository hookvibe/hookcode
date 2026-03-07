# Task Plan: Compact git status card in task group dialog

<!-- Define the implementation and verification phases for the compact git status interaction. docs/en/developer/plans/taskgroup-gitstatus-compact-20260303/task_plan.md taskgroup-gitstatus-compact-20260303 -->

## Session Metadata
- **Session Hash:** taskgroup-gitstatus-compact-20260303
- **Created:** 2026-03-03

## Goal
Make the git status block in the task-group conversation use a compact default summary card and reveal full details only when users expand it.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm the target UI surface in task-group conversation
- [x] Locate the component and style files used by git status cards
- [x] Capture behavior requirements in findings.md
- **Status:** complete

### Phase 2: UI/Interaction Design
- [x] Define compact summary fields (branch, ahead/behind, file counters)
- [x] Define expand/collapse interaction and accessibility behavior
- [x] Document implementation decisions
- **Status:** complete

### Phase 3: Implementation
- [x] Update git status panel component with collapsed-by-default mode
- [x] Update styles for compact summary and expanded details
- [x] Keep traceability comments for all changed areas
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Add/adjust frontend tests for compact default and expand behavior
- [x] Run targeted frontend tests
- [x] Run full frontend test suite
- **Status:** complete

### Phase 5: Delivery
- [x] Update progress.md with files/tests/results
- [x] Update `docs/en/change-log/0.0.0.md`
- [x] Final review and user delivery
- **Status:** complete

## Key Questions
1. Which task-group component renders the git status panel at the end of each conversation item?
2. Which fields are critical for the compact summary to keep useful signal without taking large vertical space?
3. Which existing tests should be extended to protect the new default-collapsed behavior?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use `TaskGitStatusPanel` as the change point for interaction | Keeps task detail page and task-group page behavior consistent where `compact` variant is used. |
| Keep only one expand/collapse trigger inside the compact summary button | Avoid duplicate CTA confusion while keeping the entire summary area clickable. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]` | 1 | Continued with generated plan files because session folder was created successfully. |
| Initial compact test selector expected an exact button name | 1 | Switched role query to regex because the summary button accessible name includes all summary text. |

## Notes
- Re-read this plan before major implementation edits.
- Update phase status after each milestone.

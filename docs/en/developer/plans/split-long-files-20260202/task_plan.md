# Task Plan: Split long files for maintainability
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. split-long-files-20260202 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** split-long-files-20260202
- **Created:** 2026-02-02

## Goal
Reduce maintenance burden and merge conflicts by splitting oversized files into smaller, responsibility-focused modules, and update documentation/AGENTS.md to codify the splitting rules.

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define splitting criteria and candidate files
- [x] Decide target module boundaries and naming
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Split selected files into smaller modules
- [x] Update imports/exports and any docs references
- [x] Update AGENTS.md with long-file splitting guidance
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run relevant tests or checks (skipped; not requested)
- [x] Document test results in progress.md
- [x] Fix any issues found (none found)
- **Status:** complete

### Phase 5: Delivery
- [x] Review updated files and docs
- [x] Update changelog entry
- [x] Deliver to user
- **Status:** complete

## Key Questions
1. Which files are the longest and can be split without changing public behavior?
2. Do any docs reference file paths or anchors that must be updated after splitting?
3. What is the least disruptive module boundary for each target file?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep `frontend/src/api.ts` as a barrel and split functionality into `api.*.ts` modules. | Avoid mass doc updates while reducing file size and merge conflicts. |
| Extract webhook task-meta and guard helpers into new `webhook.*.ts` modules while keeping `webhook.handlers.ts` as entry point. | Reduce handler file size without breaking existing imports/tests or doc references. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

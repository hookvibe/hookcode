# Task Plan: Move repo pull to task group workspace
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. tgpull2wkg7n9f4a */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** tgpull2wkg7n9f4a
- **Created:** 2026-01-24

## Goal
Shift git repository pull/clone from per-task execution to the first task in a task group, create a per-task-group workspace keyed by task group id, and emit thought-chain style logs for the pull step.

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
- [x] Identify data model changes for task-group workspaces
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Move repo pull to task group initialization
- [x] Bind workspace path to task group id
- [x] Add thought-chain style log output for repo pull
- [x] Update/extend tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Verify requirements and logging output
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions
1. Where is the current git pull/clone logic executed per task? (agent.ts in callAgent)
2. Where is task group creation persisted and how is task group id generated/used? (task.service.ts resolveOrCreateGroupId / ensureTaskGroupId)
3. What is the existing log format for task execution and how to render thought-chain style entries? (JSONL item.* lines parsed in frontend executionLog)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use task group id as workspace key and only pull once per group | Avoid redundant pulls and guarantee isolation between groups |
| Avoid DB schema changes by deriving workspace path from task group id | Keeps change scoped and compatible with existing task_groups table |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

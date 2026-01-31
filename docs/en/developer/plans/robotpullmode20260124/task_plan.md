# Task Plan: Robot pull mode control (direct vs fork)

## Session Metadata
- **Session Hash:** robotpullmode20260124
- **Created:** 2026-01-24

## Goal
Expose explicit repo pull mode (direct vs fork) on the robot UI, add backend enforcement, and provide a UI button to verify the selected mode (pull/fork success check).

## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Locate robot config storage for git workflow mode
- [x] Identify backend endpoints for robot update + new check action
- [x] Review UI robot settings form
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define data model changes (robot config field)
- [x] Define API endpoints + response shapes
- [x] Plan UI controls + check button behavior
- **Status:** complete

### Phase 3: Implementation
- [x] Add robot config field for pull mode
- [x] Implement backend check endpoint (direct/fork)
- [x] Wire UI control + check button
- [x] Add tests
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Run targeted tests
- [x] Update progress log
- **Status:** complete

### Phase 5: Delivery
- [x] Update changelog
- [x] Summarize changes for user
- **Status:** complete

## Key Questions
1. Where is the robot config stored and validated today? (repo-robot.service + create/update DTOs)
2. How is fork vs direct workflow currently determined? (agent configureGitWorkflow uses token push capability)
3. What UX pattern is used for robot settings actions? (RepoDetailPage robot modal + table actions)

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use repo_robots.repo_workflow_mode (nullable) with values direct/fork/auto | Preserve existing behavior when unset while allowing explicit selection |
| Add workflow test endpoint under repositories controller | Align with existing robot test actions and reuse credentials resolution |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| Jest runTestsByPath used backend/src path and found no tests | 1 | Re-ran with src/tests path |

# Task Plan: Sidebar tasks auto-expand & title layout
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Create this FIRST, before starting any work. Update after each phase completes.
-->

<!-- Track code changes with this session hash for traceability. mks8pr4r3m1fo9oqx9av -->

## Session Metadata
<!-- 
  WHAT: Stable identifiers for traceability (code comments ↔ plan folder).
  WHY: Makes it easy to find the plan that explains a change.
-->
- **Session Hash:** mks8pr4r3m1fo9oqx9av
- **Created:** 2026-01-20

## Goal
<!-- 
  WHAT: One clear sentence describing what you're trying to achieve.
  WHY: This is your north star. Re-reading this keeps you focused on the end state.
  EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality."
-->
Make the left sidebar auto-expand the `Tasks` section when there are tasks created in the last 24 hours, and redesign each task title into a 2-line layout (event + identifier on line 1, repo on line 2) while keeping the left icon visible. mks8pr4r3m1fo9oqx9av

## Current Phase
<!-- 
  WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3").
  WHY: Quick reference for where you are in the task. Update this as you progress.
-->
Phase 5

## Phases
<!-- 
  WHAT: Break your task into 3-7 logical phases. Each phase should be completable.
  WHY: Breaking work into phases prevents overwhelm and makes progress visible.
  WHEN: Update status after completing each phase: pending → in_progress → complete
-->

### Phase 1: Requirements & Discovery
<!-- 
  WHAT: Understand what needs to be done and gather initial information.
  WHY: Starting without understanding leads to wasted effort. This phase prevents that.
-->
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
<!-- 
  STATUS VALUES:
  - pending: Not started yet
  - in_progress: Currently working on this
  - complete: Finished this phase
-->

### Phase 2: Planning & Structure
<!-- 
  WHAT: Decide how you'll approach the problem and what structure you'll use.
  WHY: Good planning prevents rework. Document decisions so you remember why you chose them.
-->
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
<!-- 
  WHAT: Actually build/create/write the solution.
  WHY: This is where the work happens. Break into smaller sub-tasks if needed.
-->
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
<!-- 
  WHAT: Verify everything works and meets requirements.
  WHY: Catching issues early saves time. Document test results in progress.md.
-->
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
<!-- 
  WHAT: Final review and handoff to user.
  WHY: Ensures nothing is forgotten and deliverables are complete.
-->
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions
<!-- 
  WHAT: Important questions you need to answer during the task.
  WHY: These guide your research and decision-making. Answer them as you go.
  EXAMPLE: 
    1. Should tasks persist between sessions? (Yes - need file storage)
    2. What format for storing tasks? (JSON file)
-->
1. Where does the sidebar "recent 24h tasks" decision come from (frontend filter vs backend-provided flag), and which timestamp field should be used? → Frontend computes it from `/dashboard/sidebar` tasks using `task.updatedAt` (aligned with backend sorting). mks8pr4r3m1fo9oqx9av
2. What task fields are available to build the identifier (issue number, MR/PR number, commit hash, etc.), and do we need GitLab/GitHub-specific formatting? → Use `issueId`/`mrId` plus payload fallbacks; GitLab uses `!` for MR while GitHub-style PR uses `#`; commits use short SHA. mks8pr4r3m1fo9oqx9av

## Decisions Made
<!-- 
  WHAT: Technical and design decisions you've made, with the reasoning behind them.
  WHY: You'll forget why you made choices. This table helps you remember and justify decisions.
  WHEN: Update whenever you make a significant choice (technology, approach, structure).
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
-->
| Decision | Rationale |
|----------|-----------|
| Auto-expand `Tasks` only once when recent tasks first appear (do not block it based on early manual toggles) | Ensures the default-expanded requirement is reliable while still avoiding repeated overrides after the first auto-expand. mks8pr4r3m1fo9oqx9av |
| Fall back to `createdAt` and treat invalid timestamps as recent for the 24h check | Prevents date parsing issues from silently disabling the auto-expand behavior. mks8pr4r3m1fo9oqx9av |
| Sidebar task rows render 2 lines: primary = event label + marker, secondary = repo name | Keeps the most scannable identifier on top and preserves context with the repo line. mks8pr4r3m1fo9oqx9av |
| Derive markers from task meta first (issueId/mrId) and fall back to payload fields, with a final short-id fallback | Handles both GitLab and GitHub payload shapes while keeping the UI robust for partial data. mks8pr4r3m1fo9oqx9av |

## Errors Encountered
<!-- 
  WHAT: Every error you encounter, what attempt number it was, and how you resolved it.
  WHY: Logging errors prevents repeating the same mistakes. This is critical for learning.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | FileNotFoundError | 1 | Check if file exists, create empty list if not |
    | JSONDecodeError | 2 | Handle empty file case explicitly |
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
<!-- 
  REMINDERS:
  - Update phase status as you progress: pending → in_progress → complete
  - Re-read this plan before major decisions (attention manipulation)
  - Log ALL errors - they help avoid repetition
  - Never repeat a failed action - mutate your approach instead
-->
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

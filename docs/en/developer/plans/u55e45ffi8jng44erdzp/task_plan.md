# Task Plan: repo-details-dashboard
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Create this FIRST, before starting any work. Update after each phase completes.
-->

<!-- Track code changes with this session hash for traceability. u55e45ffi8jng44erdzp -->

## Session Metadata
<!-- 
  WHAT: Stable identifiers for traceability (code comments ↔ plan folder).
  WHY: Makes it easy to find the plan that explains a change.
-->
- **Session Hash:** u55e45ffi8jng44erdzp
- **Created:** 2026-01-18

## Goal
<!-- 
  WHAT: One clear sentence describing what you're trying to achieve.
  WHY: This is your north star. Re-reading this keeps you focused on the end state.
  EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality."
-->
Rebuild the repository details page into a single dashboard-style view (no tab switching) that surfaces Basic/Branches/Credentials/Robots/Automation/Webhooks together, preserves all existing functionality, and adds useful stats & charts. <!-- Define the end state for the repo-details dashboard refactor. u55e45ffi8jng44erdzp -->

## Current Phase
<!-- 
  WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3").
  WHY: Quick reference for where you are in the task. Update this as you progress.
-->
Complete <!-- Mark the repo detail dashboard follow-up tweaks as complete. u55e45ffi8jng44erdzp -->

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
- [x] Define the new dashboard information architecture (sections, hierarchy, interactions)
- [x] Decide chart strategy (library, data sources, empty/loading states)
- [x] Document key design/tech decisions with rationale
- **Status:** complete

### Phase 3: Implementation
<!-- 
  WHAT: Actually build/create/write the solution.
  WHY: This is where the work happens. Break into smaller sub-tasks if needed.
-->
- [x] Refactor repo details route to render dashboard sections (remove tabs)
- [x] Preserve module behaviors (CRUD, actions, permissions) in the new layout
- [x] Add stats cards and charts with responsive layout + theme support
- [x] Keep i18n coverage for all new user-facing strings
- **Status:** complete

### Phase 4: Testing & Verification
<!-- 
  WHAT: Verify everything works and meets requirements.
  WHY: Catching issues early saves time. Document test results in progress.md.
-->
- [x] Add/update frontend tests for the new dashboard layout and critical actions
- [x] Run lint/test/build and document results in progress.md
- [x] Fix regressions and UX edge cases (loading, empty, error states)
- **Status:** complete

### Phase 5: Delivery
<!-- 
  WHAT: Final review and handoff to user.
  WHY: Ensures nothing is forgotten and deliverables are complete.
-->
- [x] Final UI/UX pass (desktop/mobile, light/dark, accent color)
- [x] Update changelog with session link
- [x] Mark all phases complete
- **Status:** complete

### Phase 6: Layout Balance (Pagination / Density)
<!--
  WHAT: Adjust the dashboard layout to reduce uneven card heights and wasted whitespace.
  WHY: Side-by-side cards with very different heights create "holes" in the board layout.
-->
- [x] Reduce blank space caused by unequal module heights
- [x] Introduce pagination/scroll constraints for large lists/tables (robots, deliveries, credentials, automation)
- [x] Verify layout on desktop/mobile and both themes
- **Status:** complete

### Phase 7: Row-based Layout + Task-First Overview
<!--
  WHAT: Rebuild the repo dashboard layout into explicit full-width rows with consistent min-heights.
  WHY: Avoid tiny/empty cards and align the board with a predictable "one row per region" layout.
  NOTE: The top overview should use task statistics (not webhook deliveries) as the primary KPI scale.
-->
- [x] Move the top overview into the scrollable page body (no fixed header strip)
- [x] Implement 5-row layout (regions 1-5) with responsive left/right splits for regions 2-3
- [x] Add min-height guards + empty-state polish for large regions
- [x] Switch overview KPIs/charts to task-based stats (repo-scoped)
- [x] Update tests and i18n strings
- **Status:** complete <!-- Track the new row-based layout phase for traceability. u55e45ffi8jng44erdzp -->

### Phase 8: Robots Region + Restore Top KPI Strip
<!--
  WHAT: Split Robots into its own full-width region and restore the previous KPI summary strip within the scrollable page body.
  WHY: Improve layout consistency and keep the familiar quick-glance cards without fixed positioning.
-->
- [x] Move Robots into a standalone row region (not side-by-side with Automation)
- [x] Restore the old KPI summary strip inside the dashboard body (not fixed)
- [x] Re-verify layout (empty states + min-heights) and update tests if needed
- **Status:** complete <!-- Track the new layout tweak phase for traceability. u55e45ffi8jng44erdzp -->

## Key Questions
<!-- 
  WHAT: Important questions you need to answer during the task.
  WHY: These guide your research and decision-making. Answer them as you go.
  EXAMPLE: 
    1. Should tasks persist between sessions? (Yes - need file storage)
    2. What format for storing tasks? (JSON file)
-->
1. What data is already available for repo-level stats (events/runs/history), and what must be derived client-side? <!-- Capture open questions to guide discovery. u55e45ffi8jng44erdzp -->
2. Which chart library is already used in the frontend (or which is acceptable to add) while staying consistent with themes? <!-- Capture open questions to guide discovery. u55e45ffi8jng44erdzp -->
3. How do the existing tab modules implement mutations (create/update/delete), and what state sharing is required when rendering them together? <!-- Capture open questions to guide discovery. u55e45ffi8jng44erdzp -->

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
|          |           |

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
| Vitest mock missing `listRepoWebhookDeliveries` export | 1 | Added `listRepoWebhookDeliveries` to the `../api` mock in `frontend/src/tests/repoDetailPage.test.tsx`. |
| Repo detail test matched multiple "Save" buttons after removing tabs | 1 | Scoped the click to the Basic card via `within(basicCard)` in `frontend/src/tests/repoDetailPage.test.tsx`. |

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

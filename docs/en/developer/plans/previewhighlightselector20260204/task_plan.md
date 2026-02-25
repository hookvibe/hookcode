# Task Plan: Improve preview highlight selector fallbacks
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. previewhighlightselector20260204 */}
<!-- Maintain phase tracking for selector fallback improvements. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** previewhighlightselector20260204
- **Created:** 2026-02-04

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
<!-- Extend the goal to include advanced targetUrl route matching updates. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
Improve preview highlight selector resolution, add preview auto-navigation with a lock toggle, clarify the rules in the skill documentation, and expand targetUrl route matching rules.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
<!-- Update the current phase to track targetUrl route matching changes. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
Phase 8 (complete)

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

<!-- Track follow-up matcher phase updates for selector rules. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
### Phase 6: Follow-up Matching Rules
{/* WHAT: Add more selector matching rules and update documentation/tests. WHY: Follow-up user request. */}
- [x] Define additional matching rules
- [x] Implement bridge selector parsing updates
- [x] Update skill documentation to explain new rules
- [x] Adjust bubble placement heuristics to avoid off-screen tooltips
- [x] Add/adjust tests and rerun full suite
- **Status:** complete

<!-- Track preview auto-navigation and lock updates. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
### Phase 7: Preview Auto-Navigation + Lock
{/* WHAT: Auto-navigate previews based on target URLs and add a lock toggle. WHY: Ensure highlights land on the correct page. */}
- [x] Add target URL field to highlight requests/responses
- [x] Implement auto-navigation + lock UI in preview toolbar
- [x] Update skill/agent docs and API response notes
- [x] Add/adjust tests and rerun full suite
- **Status:** complete

<!-- Track advanced targetUrl route matching updates. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
### Phase 8: Advanced TargetUrl Route Matching
{/* WHAT: Expand route matching rules for targetUrl comparisons. WHY: Avoid unnecessary auto-navigation when routes already match with dynamic segments. */}
- [x] Define route matching rules for targetUrl (wildcards, params, query/hash handling)
- [x] Update preview auto-navigation matching logic and tests
- [x] Update skill/protocol/agent docs to describe matching rules
- [x] Rerun full test suite and log results
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Which fallback selector strategies should run when the primary selector fails?
2. How should we pick the best element when multiple matches are returned?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Add layered selector fallbacks (querySelectorAll visibility pick, simple id/class lookup, open shadow-root scan) in the bridge. | Increases hit rate without changing the API surface. |
| Add Vitest + JSDOM tests that eval the bridge script and dispatch highlight messages. | Lets us validate selector fallbacks without bundling the bridge or adding new runtime dependencies. |
| Add text/attribute matcher rules (text:, attr:, data:, aria:, role:, testid:, loose attr syntax). | Satisfies new matching rule requirements without API changes. |
| Prefer vertical bubble placement and flip when space is insufficient. | Keeps tooltip bubbles visible near viewport edges. |
| Add targetUrl-based preview auto-navigation with a lock toggle. | Keeps highlights aligned with the intended route without forcing navigation when locked. |
| Add wildcard/param route matching for targetUrl comparisons. | Avoids unnecessary navigation when dynamic routes already match. |
<!-- Record advanced targetUrl matching decision for Phase 8. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
| Use ||-separated targetUrl candidates and query/hash wildcards for match checks. | Lets auto-navigation skip route changes when any acceptable pattern matches. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| Vitest could not read the bridge script via URL (non-file scheme). | 1 | Switched to a path resolved from `process.cwd()` in the test helper. |
| Visible match test failed because empty computed opacity parsed to 0. | 1 | Guarded opacity parsing with `Number.isFinite` before treating opacity as zero. |
| Visible match test still failed because empty opacity string parsed to 0. | 2 | Ignore empty opacity tokens before numeric parsing. |
<!-- Track the test runner warning observed during Phase 8 validation. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
| Jest worker failed to exit gracefully warning during full test runs. | 1 | Logged warning; tests passed and no new timers were added. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

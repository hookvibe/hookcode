# Findings & Decisions: Sidebar tasks auto-expand & title layout
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. mks8pr4r3m1fo9oqx9av -->

## Session Metadata
- **Session Hash:** mks8pr4r3m1fo9oqx9av
- **Created:** 2026-01-20

## Requirements
<!-- 
  WHAT: What the user asked for, broken down into specific requirements.
  WHY: Keeps requirements visible so you don't forget what you're building.
  WHEN: Fill this in during Phase 1 (Requirements & Discovery).
  EXAMPLE:
    - Command-line interface
    - Add tasks
    - List all tasks
    - Delete tasks
    - Python implementation
-->
<!-- Captured from user request -->
- Left sidebar should auto-expand the `Tasks` section when there is any task within the last 24 hours (expanded state is required by default in that case). mks8pr4r3m1fo9oqx9av
- Task item title in the sidebar should be optimized into 2 lines: line 1 shows event type + event identifier (e.g., issue `#1`, commit short hash), line 2 shows repo name in small gray text. mks8pr4r3m1fo9oqx9av
- The left icon/marker for each task must still be visible and aligned even with the 2-line layout. mks8pr4r3m1fo9oqx9av

## Research Findings
<!-- 
  WHAT: Key discoveries from web searches, documentation reading, or exploration.
  WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately.
  WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule).
  EXAMPLE:
    - Python's argparse module supports subcommands for clean CLI design
    - JSON module handles file persistence easily
    - Standard pattern: python script.py <command> [args]
-->
<!-- Key discoveries during exploration -->
- Sidebar task sections are implemented in `frontend/src/pages/AppShell.tsx` via `renderSidebarTaskSection()` and controlled by `taskSectionExpanded` state. mks8pr4r3m1fo9oqx9av
- There is already an "auto-expand if task updated within last 24h" initializer, but it runs only once per auth session (`taskSectionAutoInitRef`), so if the first refresh sees no recent tasks the sidebar may never auto-expand later. mks8pr4r3m1fo9oqx9av
- Sidebar task rows currently render a single-line title: `clampText(getTaskTitle(task), 32)`, so the 2-line event/repo layout needs a new rendering path (and likely a new helper in `frontend/src/utils/task`). mks8pr4r3m1fo9oqx9av

## Technical Decisions
<!-- 
  WHAT: Architecture and implementation choices you've made, with reasoning.
  WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge.
  WHEN: Update whenever you make a significant technical choice.
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
    | argparse with subcommands | Clean CLI: python todo.py add "task" |
-->
<!-- Decisions made with rationale -->
| Decision | Rationale |
|----------|-----------|
| Auto-expand status sections only when a recent task first appears; do not block based on early manual toggles | Prevents the initializer from being disabled by incidental clicks before recent tasks arrive. mks8pr4r3m1fo9oqx9av |
| Use `createdAt` as a fallback and treat invalid timestamps as recent for the 24h check | Keeps auto-expand reliable even if the backend returns non-ISO timestamp strings. mks8pr4r3m1fo9oqx9av |
| Sidebar task label uses `eventType + marker` (line 1) and `repo name` (line 2) | Prioritizes the most scannable identifier (Issue/MR/Commit) and keeps repo context without increasing sidebar width. mks8pr4r3m1fo9oqx9av |
| Marker extraction prefers task meta fields and falls back to payload (`issue.number/iid`, `mr iid/PR number`, `after/commit sha`) | Makes the UI resilient across GitLab/GitHub payload shapes and partial task records. mks8pr4r3m1fo9oqx9av |

## Issues Encountered
<!-- 
  WHAT: Problems you ran into and how you solved them.
  WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors).
  WHEN: Document when you encounter blockers or unexpected challenges.
  EXAMPLE:
    | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() |
-->
<!-- Errors and how they were resolved -->
| Issue | Resolution |
|-------|------------|
| AppShell tests broke after changing task row text (now shows event+marker + repo) | Updated mocked task fixtures and scoped repo-list queries to avoid matching the sidebar repo meta lines. mks8pr4r3m1fo9oqx9av |
| Sidebar auto-expand still did not trigger reliably in some environments | Removed the manual-toggle guard from the initializer and added a `createdAt` fallback + tolerant timestamp parsing. mks8pr4r3m1fo9oqx9av |

## Resources
<!-- 
  WHAT: URLs, file paths, API references, documentation links you've found useful.
  WHY: Easy reference for later. Don't lose important links in context.
  WHEN: Add as you discover useful resources.
  EXAMPLE:
    - Python argparse docs: https://docs.python.org/3/library/argparse.html
    - Project structure: src/main.py, src/utils.py
-->
<!-- URLs, file paths, API references -->
- frontend/src/pages/AppShell.tsx (sidebar sections + auto-expand + task row rendering) mks8pr4r3m1fo9oqx9av
- frontend/src/utils/task.tsx (event marker + repo extraction helpers) mks8pr4r3m1fo9oqx9av
- frontend/src/styles.css (sidebar task row 2-line layout) mks8pr4r3m1fo9oqx9av
- frontend/src/tests/appShell.test.tsx (regression tests for auto-expand + 2-line labels) mks8pr4r3m1fo9oqx9av

## Visual/Browser Findings
<!-- 
  WHAT: Information you learned from viewing images, PDFs, or browser results.
  WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text.
  WHEN: IMMEDIATELY after viewing images or browser results. Don't wait!
  EXAMPLE:
    - Screenshot shows login form has email and password fields
    - Browser shows API returns JSON with "status" and "data" keys
-->
<!-- CRITICAL: Update after every 2 view/browser operations -->
<!-- Multimodal content must be captured as text immediately -->
-

---
<!-- 
  REMINDER: The 2-Action Rule
  After every 2 view/browser/search operations, you MUST update this file.
  This prevents visual information from being lost when context resets.
-->
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

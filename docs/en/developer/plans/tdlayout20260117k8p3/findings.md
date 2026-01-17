# Findings & Decisions: Frontend Task detail layout redesign
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. tdlayout20260117k8p3 -->

## Session Metadata
- **Session Hash:** tdlayout20260117k8p3
- **Created:** 2026-01-17

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
- Task detail page should not be constrained by `max-width: var(--hc-page-max)`; content must span the full viewport width.
- Add a top, single-row, full-width summary strip showing more key info than the current 3 parallel cards.
- Below the summary strip, use a two-column layout:
  - Left: sidebar-like area that presents the textual task details.
  - Right (~70% width): a workflow area containing 4 sections connected via an AntD `Steps` visual: Result (top), Live logs, Prompt patch, Raw webhook payload.
- Ensure the scrolling experience is ergonomic (avoid awkward nested scroll where possible; long payload/log blocks should remain usable).

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
- `frontend/src/pages/TaskDetailPage.tsx` currently renders meta cards (Repository/Robot/Author), a Descriptions list, logs viewer, result, and payload collapse panels.
- The page width constraint comes from the global rule `.hc-page__body > * { max-width: var(--hc-page-max); margin: 0 auto; }` in `frontend/src/styles.css`.
- Existing i18n keys already cover the requested section titles: `task.page.resultTitle`, `task.page.logsTitle`, `tasks.promptCustom` ("Prompt patch"), and `tasks.payloadRaw` ("Raw webhook payload").
- No existing `hc-page--*` modifier class is present; a task-detail-specific wrapper class will be needed to override the global max-width rule safely.
- The frontend already has a monospace log viewer style (`.log-viewer__pre`) and markdown code block styling (`.markdown-result pre code`), which can inform the payload/prompt block styling for consistency.

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
| Add `hc-task-detail-page` wrapper to override global max-width rule | Keeps the full-width behavior scoped to Task detail, avoiding layout regressions on other pages. |
| Place the top summary strip between `PageNav` and `.hc-page__body` | Keeps key info always visible while the main content scrolls. |
| Use a split (sidebar + main) flex layout with responsive stacking | Matches the requested ~70% main area on desktop while remaining usable on mobile. |
| Render the 4 main sections inside AntD `Steps` (vertical) descriptions | Achieves the "Steps-connected" visual without introducing complex custom timeline layout. |

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
|       |            |

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
- `frontend/src/pages/TaskDetailPage.tsx`
- `frontend/src/styles.css` (page layout + task meta cards)
- `frontend/src/tests/taskDetailPage.test.tsx` (will need updates after layout changes)

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

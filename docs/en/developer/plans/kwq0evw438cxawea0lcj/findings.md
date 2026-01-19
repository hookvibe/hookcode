# Findings & Decisions: Sidebar hover tooltips & status nav button
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. kwq0evw438cxawea0lcj -->

## Session Metadata
- **Session Hash:** kwq0evw438cxawea0lcj
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
- Sidebar task rows: add a hover affordance that shows the full task title (tooltip). kwq0evw438cxawea0lcj
- Sidebar task status headers (Queued/Processing/Completed/Failed): on hover, replace the right-side count with a right-arrow navigation control; clicking it should jump to the Tasks list filtered by that status. kwq0evw438cxawea0lcj

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
- Sidebar task status headers and task preview rows are rendered in `frontend/src/pages/AppShell.tsx` under `renderSidebarTaskSection()`. kwq0evw438cxawea0lcj
- Ant Design icon components may contribute `aria-label` text to a Button's accessible name, so tests should sometimes locate buttons via visible label text rather than exact role+name matching. kwq0evw438cxawea0lcj

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
| Wrap sidebar task item rows with AntD `Tooltip` (`mouseEnterDelay=0`) | Meets the hover-title requirement with minimal layout change and keeps the sidebar compact. kwq0evw438cxawea0lcj |
| Add a separate status header nav button on the right (count ↔ arrow via CSS `:hover`) | Avoids nested interactive elements and makes it easy to stop propagation so expand/collapse is not triggered by nav clicks. kwq0evw438cxawea0lcj |
| Use `aria-label="View all {Status}"` for the nav button | Makes the numeric/arrow-only control discoverable to screen readers without adding new translation keys. kwq0evw438cxawea0lcj |

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
| Tests could not find the "View all" button by exact accessible name after UI changes | Updated tests to locate the button via its visible label (`findByText('View all')`) and then click the closest `<button>`. kwq0evw438cxawea0lcj |

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
- frontend/src/pages/AppShell.tsx (task Tooltip + status header nav button) kwq0evw438cxawea0lcj
- frontend/src/styles.css (count↔arrow hover styles for status header) kwq0evw438cxawea0lcj
- frontend/src/tests/appShell.test.tsx (tests for tooltip + header nav) kwq0evw438cxawea0lcj

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

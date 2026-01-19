# Findings & Decisions: Dashboard chart: line + range filter
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. dashtrendline20260119m9v2 -->

## Session Metadata
- **Session Hash:** dashtrendline20260119m9v2
- **Created:** 2026-01-19

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
- Replace the repo dashboard 7-day bar chart with a line chart. dashtrendline20260119m9v2
- Ensure the rightmost data point is always "today" (not "last task day"). dashtrendline20260119m9v2
- Add preset range controls: 7 days, 30 days, 6 months, 1 year. dashtrendline20260119m9v2
- Allow selecting a custom date range (start/end) to query the chart. dashtrendline20260119m9v2

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
- `frontend/src/components/repos/RepoTaskActivityCard.tsx` currently derives a 7d bar chart by fetching up to 200 recent tasks and counting `createdAt` per UTC day. dashtrendline20260119m9v2
- The existing chart anchors the 7-day window to the latest task day (or now fallback), so the rightmost bar can be a non-today day when no tasks were created today. dashtrendline20260119m9v2
- Supporting 30d/6m/1y + custom ranges requires an aggregated backend endpoint (fetching raw task lists with large limits is not scalable or accurate). dashtrendline20260119m9v2

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
| Add a backend endpoint to return daily task counts for a repo/date range | Avoid fetching large task lists and keep the chart accurate for long ranges. dashtrendline20260119m9v2 |
| Use UTC day buckets (`YYYY-MM-DD`) for aggregation and filling missing days | Keep frontend/backend consistent and avoid timezone ambiguity in API payloads. dashtrendline20260119m9v2 |
| Render the trend as a lightweight SVG line chart (no new heavy chart deps) | Keep bundle size small and match existing "custom chart via CSS" approach. dashtrendline20260119m9v2 |
| API contract: `GET /api/tasks/volume?repoId=<uuid>&startDay=YYYY-MM-DD&endDay=YYYY-MM-DD` → `{ points: { day, count }[] }` | Simple contract that supports presets + custom ranges while letting the frontend fill missing days and format labels. dashtrendline20260119m9v2 |
| Preset ranges map to "N days ending today (UTC day)" | Matches the existing chart's UTC day logic and guarantees the rightmost point is always today. dashtrendline20260119m9v2 |

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
-

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

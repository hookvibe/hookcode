# Findings & Decisions: Repo Task activity metrics show recent tasks
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. aw85xyfsp5zfg6ihq3jr -->

## Session Metadata
- **Session Hash:** aw85xyfsp5zfg6ihq3jr
- **Created:** 2026-01-20

## Navigation
<!-- Add cross-links between session docs for easier navigation. aw85xyfsp5zfg6ihq3jr -->
- [Task plan](task_plan.md)
- [Progress log](progress.md)

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
- In repo detail "Task activity", the Total/Processing/Failed metric tiles must show the latest 3 tasks.
- Each task entry must display event + a shortened task id.
- Each task entry must allow navigating to the corresponding task detail.
- Each metric tile must provide a "View all tasks of this status" action (ideally repo-scoped).
- Replace the "Last task" metric with a "Success" metric section.

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
- `RepoTaskActivityCard` already fetches recent tasks for the repo via `fetchTasks({ repoId, limit: 200 })`, so the UI can derive "latest 3" client-side without new APIs.
- The global Tasks page supports a `status` filter via hash query (`#/tasks?status=...`) but does not currently support `repoId` filtering; adding `repoId` would enable repo-scoped "View all" from repo detail.

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
| Add `repoId` hash query support to Tasks page | Allows repo dashboards to link to "all tasks of this status" without mixing tasks from other repos |
| Compute "latest 3 tasks" client-side from `fetchTasks({ repoId, limit: 200 })` | Avoids new backend endpoints while meeting the UI requirement |
| Define "Success" recent tasks as `succeeded` + `commented` | Aligns with the existing "success" bucket in repo task stats |

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
- `frontend/src/components/repos/RepoTaskActivityCard.tsx` (Task activity card UI)
- `frontend/src/pages/TasksPage.tsx` (Tasks list page; currently status-only filter)
- `frontend/src/router.ts` (hash parsing + `buildTasksHash`)
- `frontend/src/utils/task.tsx` (task label helpers + event mappings)

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

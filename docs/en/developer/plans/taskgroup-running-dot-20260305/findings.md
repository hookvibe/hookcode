# Findings & Decisions: Sidebar indicator for running task groups
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. taskgroup-running-dot-20260305 */}

## Session Metadata
- **Session Hash:** taskgroup-running-dot-20260305
- **Created:** 2026-03-05

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- When a task group has running tasks on the home page, show a special indicator (e.g., a small dot) next to that task group in the left sidebar.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Modern sidebar task-group rows currently show a dot only for `previewActive` (`frontend/src/components/ModernSidebar.tsx`, `.hc-nav-preview-dot`).
- Dashboard sidebar API (`backend/src/modules/tasks/dashboard.controller.ts`) decorates task groups with `previewActive` but has no running-task indicator.
- Task group DTO/type (`backend/src/modules/tasks/dto/task-groups-swagger.dto.ts`, `backend/src/types/taskGroup.ts`, `frontend/src/api/types/tasks.ts`) includes `previewActive` only.
- Task group rendering in `ModernSidebar` already has a label container suitable for another indicator dot.
- `TaskService.listTaskGroups` is the central path for fetching task groups; no existing helper returns running-task group IDs.
- Dashboard controller now needs a running-task group lookup to decorate sidebar task groups accurately.
- `hasRunningTasks` is added to task group types/DTOs and set in the dashboard sidebar response to drive the UI indicator.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add backend-derived `hasRunningTasks` for sidebar task groups (processing status only). | Accurate indicator for listed groups without relying on limited frontend task snapshots. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| init-session.sh failed due to missing docs.json navigation.languages[] | Proceeded without docs.json sync; planning files created successfully. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- frontend/src/components/ModernSidebar.tsx
- frontend/src/styles/modern-sidebar.css
- backend/src/modules/tasks/dashboard.controller.ts
- backend/src/modules/tasks/dto/task-groups-swagger.dto.ts
- backend/src/types/taskGroup.ts
- frontend/src/api/types/tasks.ts

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

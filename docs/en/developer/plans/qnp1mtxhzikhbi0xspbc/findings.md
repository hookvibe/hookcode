# Findings & Decisions: Archive repositories and tasks
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. qnp1mtxhzikhbi0xspbc -->

## Session Metadata
- **Session Hash:** qnp1mtxhzikhbi0xspbc
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
- Add an archiving mechanism for repository-related content.
- Archived content must have a dedicated display area.
- Add a small icon at the bottom of the left sidebar; click to enter the Archive area.
- Archiving a repository must also archive its related tasks (and task groups if applicable).
- Provide a way to view and restore (unarchive) archived repos/tasks.
- Archived repositories must be read-only: block all write operations (e.g. branches/robots/automation/credentials) and allow view-only access. qnp1mtxhzikhbi0xspbc
<!-- UX refinement: the Archive area should not show "enabled" as a primary status since archived repos are view-only. qnp1mtxhzikhbi0xspbc -->
- Archive repo cards must display archive-focused status (Archived + archived time) and avoid misleading "enabled/disabled" badges.

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
- Frontend routing is hash-based (`frontend/src/router.ts`) and sidebar layout lives in `frontend/src/pages/AppShell.tsx`.
- Repo list/detail pages are `frontend/src/pages/ReposPage.tsx` and `frontend/src/pages/RepoDetailPage.tsx`.
- Tasks and task groups are first-class concepts in both backend (NestJS) and frontend (`frontend/src/pages/TasksPage.tsx`, `TaskGroupChatPage.tsx`).
- Backend data model uses Prisma with `Repository`, `Task`, `TaskGroup` models (`backend/prisma/schema.prisma`).
- Task listing uses raw SQL in `backend/src/modules/tasks/task.service.ts` (needs archive filter to be applied consistently).
- UX guideline: archive navigation entry should have an obvious active state and keep predictable back behavior (sidebar navigation should reset back-chain, consistent with current AppShell behavior).
<!-- Record the root cause: archived repos were still writable due to missing backend guards and UI readOnly propagation. qnp1mtxhzikhbi0xspbc -->
- Bug discovery: archived repositories still allowed write actions (e.g., adding branches) because repo-scoped write endpoints and some detail-page widgets were not yet guarded by `archivedAt`.
<!-- Enumerate repo-scoped write endpoints that must be blocked for archived repos. qnp1mtxhzikhbi0xspbc -->
- Backend audit: `backend/src/modules/repositories/repositories.controller.ts` contains multiple repo-scoped write endpoints (`PATCH /repos/:id`, robots CRUD/test, `PUT /repos/:id/automation`) that currently only check repo existence and must be made archive-aware.
<!-- Capture UI discovery about ArchivePage repo cards. qnp1mtxhzikhbi0xspbc -->
- UI discovery: `frontend/src/pages/ArchivePage.tsx` repo cards currently show an `enabled/disabled` tag in the top-right, which is misleading inside the Archive area.

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
| Add `archivedAt` (nullable timestamp) to Repository/Task/TaskGroup | Simple, queryable, and reversible; supports "active vs archived" filtering and cascade updates. |
| Default all list APIs to exclude archived items | Keeps existing UX unchanged; archived content lives in a dedicated area. |
| Provide explicit repo archive/unarchive endpoints | Allows atomic cascading updates and clearer permissions/intent than generic PATCH. |
| Add an Archive page with tabs (Repos/Tasks) | Matches "dedicated area" requirement while keeping navigation compact via sidebar bottom icon. |
| Return `403` with `code=REPO_ARCHIVED_READ_ONLY` for archived repo write attempts | Provides a stable backend enforcement point; frontend disables controls for UX but backend is the security boundary. qnp1mtxhzikhbi0xspbc |

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
- backend/prisma/schema.prisma
- backend/src/modules/repositories/repositories.controller.ts
- backend/src/modules/repositories/repository.service.ts
- backend/src/modules/tasks/task.service.ts
- backend/src/modules/tasks/tasks.controller.ts
- backend/src/modules/tasks/task-groups.controller.ts
- frontend/src/pages/AppShell.tsx
- frontend/src/router.ts
- frontend/src/api.ts

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

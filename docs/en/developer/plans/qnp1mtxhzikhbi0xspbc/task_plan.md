# Task Plan: Archive repositories and tasks
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. qnp1mtxhzikhbi0xspbc */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** qnp1mtxhzikhbi0xspbc
- **Created:** 2026-01-20

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Add a repository+task archiving mechanism with a dedicated "Archive" area in the frontend sidebar and backend APIs that cascade archive/unarchive between repos and related tasks/groups.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 7

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent (archive repos + related tasks)
- [x] Identify frontend/backend touch points (repos/tasks/task groups/sidebar)
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Define data model changes (archivedAt fields + indexes)
- [x] Define API surface (list filters + archive/unarchive endpoints)
- [x] Define frontend IA (sidebar bottom icon -> Archive page with tabs)
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Backend: Prisma schema + migration
- [x] Backend: repo archive/unarchive + cascading task/group updates
- [x] Backend: list filters exclude archived by default (repos/tasks/task-groups/dashboard)
- [x] Frontend: add route + sidebar entry + Archive page (repos/tasks)
- [x] Frontend: add repo archive/unarchive action and archived state UX
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Add unit tests for backend filters + cascade behavior
- [x] Update frontend tests for sidebar navigation
- [x] Run `pnpm -C backend test` + `pnpm -C backend build` + `pnpm -C frontend test` + `pnpm -C frontend build`
- [x] Document test results in progress.md
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Update `docs/en/change-log/0.0.0.md` with hash + plan link
- [x] Ensure phases are complete (optional: check-complete.sh)
- [x] Summarize design + how to use
- **Status:** complete

{/* Add an extra phase to enforce archived repos as read-only across backend and frontend. qnp1mtxhzikhbi0xspbc */}
### Phase 6: Archived Repo Read-Only Isolation
- [x] Backend: block repo-scoped write endpoints when `archivedAt` is set
- [x] Frontend: disable/hide write UI (branches/robots/automation/etc.) when archived
- [x] Add/update unit tests for archived repo write blocking
- [x] Run backend/frontend tests + builds and document results
- [x] Update changelog entry if needed (same hash)
- **Status:** complete

{/* Refine Archive repo cards to avoid misleading "enabled" status and present archive-specific metadata. qnp1mtxhzikhbi0xspbc */}
### Phase 7: Archive Repo Card UX
- [x] Frontend: replace misleading `enabled` tag with archive-focused status tags
- [x] Frontend: adjust repo card actions/labels to reflect view-only semantics
- [x] Add/update unit tests for ArchivePage repo card rendering
- [x] Run frontend tests + build and document results
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Should archived repos/tasks be hidden by default from lists, sidebar, and dashboards? (default: yes)
2. What is the archive scope and reversibility? (repo archive cascades to tasks + task groups; unarchive restores all)
3. Should archived repos block new webhook-triggered / manual tasks? (default: yes to preserve "archived" meaning)
4. What is the UI entry and content structure? (sidebar bottom icon -> Archive page with repos/tasks tabs)
5. Which repo-scoped endpoints must be blocked when archived? (patch repo/branches, robots CRUD/test, automation save, credentials updates) qnp1mtxhzikhbi0xspbc

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Add `archivedAt` timestamps (repos/tasks/task_groups) | Simple "active vs archived" filtering and reversible archive state. |
| Default APIs exclude archived items | Keep existing UX intact and avoid surprising existing pages. |
| Repo archive/unarchive as explicit endpoints | Atomic cascading updates and clearer intent vs generic PATCH. |
| Skip archived tasks in worker queue | Prevent archived work from being executed after archival. |
| Add Archive entry as bottom sidebar icon + ArchivePage tabs | Meets "dedicated area" requirement with compact navigation. |
| Block all write endpoints for archived repositories | Enforce "archive = read-only" as a backend rule; UI-only disabling is not a security boundary. qnp1mtxhzikhbi0xspbc |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| Frontend tests: `t is not a function` in ArchivePage | 1 | Fixed `statusTag` call signature to `statusTag(t, status)`. |
| Backend tests: TasksController.volumeByDay arg count mismatch | 1 | Updated unit test to pass the new `archived` arg. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

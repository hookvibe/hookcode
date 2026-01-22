# Findings & Decisions: 
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. nykx5svtlgh050cstyht */}

## Session Metadata
- **Session Hash:** nykx5svtlgh050cstyht
- **Created:** 2026-01-17

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Split current `TASK_LOGS_ENABLED` into two configs: (1) enable persisting task logs to DB, (2) enable exposing task logs to users.
- Support "persist=true, visible=false" so logs are stored but not visible to users.
- Defaults: both `true`.
- CI behavior: DB persistence `true`, user visibility `false`.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Previous design: `TASK_LOGS_ENABLED` gated both DB persistence and user-facing visibility, defaulting to `false`.
- Updated design: split into `TASK_LOGS_DB_ENABLED` and `TASK_LOGS_VISIBLE_ENABLED` (defaults: `true`), with effective enablement `db && visible`.
- CI env generation now defaults to `TASK_LOGS_DB_ENABLED=true` and `TASK_LOGS_VISIBLE_ENABLED=false` in `docker/ci/write-ci-env.sh`.
- Backend user-facing logs APIs and `task.canViewLogs` are gated by the effective "enabled" flag (see `backend/src/modules/tasks/tasks.controller.ts`).
- Agent-side log capture/persistence is gated by the DB toggle only (see `backend/src/agent/agent.ts`).
- Frontend caches `/auth/me` feature flags (`features.taskLogsEnabled`) and uses it to guard rendering of the Live logs UI to avoid SSE 404 retry loops (see `frontend/src/pages/AppShell.tsx`, `TaskDetailPage.tsx`, `TaskGroupChatPage.tsx`).
- i18n strings no longer mention the env var name; backend unit tests cover the split toggles + legacy fallback.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Split into `TASK_LOGS_DB_ENABLED` + `TASK_LOGS_VISIBLE_ENABLED` (defaults: true) | Allows "persist but not visible" deployments (CI) while keeping logs available for debugging. |
| Treat effective visibility as `DB && VISIBLE` | Avoids exposing empty/non-existent logs when persistence is disabled. |
| Support `TASK_LOGS_ENABLED` as legacy fallback | Minimizes breaking config changes during rollout. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
-

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

# Findings & Decisions: Add task group token list page in sidebar



# Findings & Decisions: Add task group token list page in sidebar
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. taskgroup-token-sidebar-20260302 */}

## Session Metadata
- **Session Hash:** taskgroup-token-sidebar-20260302
- **Created:** 2026-03-02

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Add a dedicated left sidebar menu entry on the repo page for task group API tokens.
- Show the token list in a dedicated page/section with pagination to handle many tokens.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The planning session was initialized successfully, but docs.json navigation sync failed due to missing navigation.languages[]; no docs navigation updates were applied.
- Repo detail UI already renders task-group API tokens in the bottom section with pagination state (`TASK_GROUP_TOKEN_PAGE_SIZE`, `repoTaskGroupTokensPage`) in `frontend/src/pages/RepoDetailPage.tsx`.
- Repo detail i18n strings for task-group API tokens live in `frontend/src/i18n/messages/zh-CN/repos.ts`.
- The task-group API token list currently lives inside the repo detail Settings tab as a section block, with refresh + revoke actions and a small `Pagination` control.
- Repo detail sidebar navigation is implemented in `frontend/src/components/repos/RepoDetailSidebar.tsx` and uses `RepoTab` values from `frontend/src/router.ts`.
- Task-group tokens are loaded in `RepoDetailPage` via `fetchMyApiTokens()` + `fetchTaskGroups({ repoId, archived: 'all', limit: 200 })`, then filtered by task-group ID extracted from token names.
- Repo detail sidebar tab labels live in `frontend/src/i18n/messages/en-US/repos.ts` and `frontend/src/i18n/messages/zh-CN/repos.ts`, so a new tab will need matching i18n entries.
- Repo detail content rendering is gated by `activeTab` in `RepoDetailPage`, and current tests assert task-group tokens render inside the settings tab.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add a new repo detail tab for task-group API tokens and move the list out of the settings tab. | The request explicitly asks for a dedicated sidebar entry, and this avoids burying a long list in settings. |
| Increase task-group token page size now that it is a full page. | A dedicated page can show more items per page without cramping layout. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- frontend/src/pages/RepoDetailPage.tsx
- frontend/src/i18n/messages/zh-CN/repos.ts
- package.json (test script: `pnpm --filter hookcode-backend test && pnpm --filter hookcode-frontend test`)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

## Session Metadata
- **Session Hash:** taskgroup-token-sidebar-20260302
- **Created:** 2026-03-02

## Requirements


-

## Research Findings


-

## Technical Decisions


| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered


| Issue | Resolution |
|-------|------------|
|       |            |

## Resources


-

## Visual/Browser Findings



-

---

*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

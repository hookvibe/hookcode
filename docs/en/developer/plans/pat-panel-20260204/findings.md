# Findings & Decisions: Move auto-generated PATs to repo area



# Findings & Decisions: Move auto-generated PATs to repo area
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. pat-panel-20260204 */}

## Session Metadata
- **Session Hash:** pat-panel-20260204
- **Created:** 2026-02-04

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Panel PAT page should only show manually created user PATs.
- Auto-generated TaskGroup PATs should be moved to a repository-level area for management.
<!-- Capture baseline requirements for separating panel vs repo PATs. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204 -->

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Planning session initialized; no code locations identified yet for PAT list or auto-generated PAT metadata.
- PAT management UI and list logic live in `frontend/src/components/UserPanelPopover.tsx` (credentials panel). 
- PAT data model is `UserApiToken` in `backend/prisma/schema.prisma`.
- `UserApiToken` schema has no source/type field; only name/scopes/expiry metadata.
- Auto-generated task-group PATs are created in `backend/src/agent/agent.ts` via `ensureTaskGroupPat` with name `task-group-<taskGroupId>`, tasks:write scope, and no expiry.
- `UserApiTokenService.listTokens` returns all tokens for the user without filtering; create/update flows do not tag origin.
- Repo details UI lives in `frontend/src/pages/RepoDetailPage.tsx` with a credentials section already used for repo provider tokens.
- PAT list API endpoints are under `GET/POST/PATCH /api/users/me/api-tokens` and currently return all user tokens without source filtering.
- Repository APIs are handled in `backend/src/modules/repositories/repositories.controller.ts`; no existing repo endpoint for task-group PAT listings.
- `TaskService.listTaskGroups` supports filtering by `repoId`, which can be used to map task-group IDs to auto-generated PAT names.
- Frontend uses `frontend/src/api/credentials.ts` for `/users/me/api-tokens` calls; no repo-scoped PAT API helper exists yet.
- Repo detail credentials UI lives in `frontend/src/pages/RepoDetailPage.tsx` under the `credentials` tab with two cards (repo provider + model provider), leaving space to add a repo-level auto-generated PAT card.
- Frontend already has `fetchTaskGroups` in `frontend/src/api/taskGroups.ts` that supports `repoId`, enabling repo-scoped task-group lookup without new backend endpoints.
- `RepoDetailPage` tests mock `../api` and will need new mocks if the page starts calling `fetchMyApiTokens` or `fetchTaskGroups`.
- `RepoDetailPage` already loads data via `fetchRepo` and other effects, so new auto-PAT data fetching can align with existing async load patterns.
- Repo detail i18n strings are not in `frontend/src/i18n/messages/en-US/ui.ts`, so new repo-level PAT copy likely belongs in `frontend/src/i18n/messages/en-US/repos.ts`.
- Repo detail translations are centralized in `frontend/src/i18n/messages/en-US/repos.ts` and `frontend/src/i18n/messages/zh-CN/repos.ts`.
- `UserPanelPopover` loads PATs in `refreshApiTokens` via `fetchMyApiTokens`, which is the right spot to filter out auto-generated task-group tokens.
- `UserPanelPopover` imports utilities near the top (`../utils/env`, etc.), so the new task-group PAT helper should be added there.
- Repo detail page imports API helpers from `../api` (barrel); confirm where to add `fetchMyApiTokens`, `revokeMyApiToken`, and `fetchTaskGroups` exports.
- API barrel `frontend/src/api.ts` already re-exports `taskGroups` and `credentials`, so repo detail can import `fetchTaskGroups` and PAT helpers from `../api` without extra wiring.
- `RepoDetailPage` has a dedicated refresh effect for preview config, so adding a separate auto-PAT refresh effect will fit the existing async pattern.
- `common.refresh` i18n key exists in `frontend/src/i18n/messages/*/core.ts`, so the auto-PAT card can reuse it for a refresh action.
- Root `pnpm test` runs backend + frontend tests; frontend tests run via `node ./scripts/run-vitest.cjs`.
<!-- Record auto-generated PAT naming and location in agent service. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204 -->
<!-- Record initial code locations for PAT list and schema. docs/en/developer/plans/pat-panel-20260204/task_plan.md pat-panel-20260204 -->

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- docs/en/developer/plans/pat-panel-20260204/task_plan.md
- frontend/src/components/UserPanelPopover.tsx
- backend/prisma/schema.prisma
- backend/src/agent/agent.ts
- backend/src/modules/users/user-api-token.service.ts
- backend/src/modules/users/users.controller.ts
- frontend/src/pages/RepoDetailPage.tsx
- frontend/src/api/taskGroups.ts
- backend/src/modules/repositories/repositories.controller.ts
- backend/src/modules/tasks/task.service.ts
- frontend/src/api/credentials.ts
- frontend/src/pages/RepoDetailPage.tsx

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
- **Session Hash:** pat-panel-20260204
- **Created:** 2026-02-04

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

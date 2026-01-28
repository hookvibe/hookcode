# Findings & Decisions: credential list unify



# Findings & Decisions: credential list unify
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. 4j0wbhcp2cpoyi8oefex */}

## Session Metadata
- **Session Hash:** 4j0wbhcp2cpoyi8oefex
- **Created:** 2026-01-28

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Need unified display and save flow for repo evaluation credentials and model credentials, using a single repo list + single model list with a scope flag (account vs repo).
- Repo detail page should show model provider credentials in a list with scope attribute and allow selection when adding.
- Account-level credential management should also use the unified list with scope selection.
- Default selection should be handled inside the manage modal instead of separate dropdowns.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Backend has repo-scoped credentials stored on repositories (`repository.service.ts`) and account model credentials on users (`user.service.ts`).
- Frontend repo detail page (`frontend/src/pages/RepoDetailPage.tsx`) already loads `repoScopedCredentials` and manages repo credential source/profile selection.
- Repo-scoped model provider credentials live under `repoScopedCredentials.modelProvider[provider].profiles` and are surfaced in repo detail UI.
- Repo credential source enforcement and validation lives in `repositories.controller.ts` and `repoRobotAccess.ts`.
- Account-level credentials UI is handled by `frontend/src/components/UserPanelPopover.tsx`, which loads/saves `fetchMyModelCredentials` and has separate forms for repo provider profiles and model provider profiles.
- `backend/src/modules/users/user.service.ts` stores account-level model credentials in `user.modelCredentials`, normalizes profiles, and exposes public shapes without secrets.
- `backend/src/modules/repositories/repository.service.ts` stores repo-scoped credentials in repository fields `repoProviderCredentials` and `modelProviderCredentials`, with a `getRepoScopedCredentials` helper that returns normalized + public shapes.
- `backend/src/modules/users/users.controller.ts` exposes `/users/me/model-credentials` GET/PATCH and `/users/me/model-credentials/models` endpoints for account-level credential lists and model discovery.
- `backend/src/modules/repositories/repositories.controller.ts` exposes `/repos/:id/model-credentials/models` for repo-scoped model discovery; repo update returns `repoScopedCredentials` after credential changes.
- `frontend/src/components/UserPanelPopover.tsx` saves account-level repo/model credential profiles via `updateMyModelCredentials`, with separate list sections per provider and modals for add/edit.
- `frontend/src/pages/RepoDetailPage.tsx` manages repo-scoped credential profiles via `patchRepoScopedCredentials` (updateRepo), and only preloads account credentials when robot/onboarding modals are open.

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
- backend/src/modules/repositories/repository.service.ts
- backend/src/modules/repositories/repositories.controller.ts
- backend/src/modules/users/user.service.ts
- frontend/src/pages/RepoDetailPage.tsx
- frontend/src/components/repos/RepoDetailProviderActivityRow.tsx
- frontend/src/components/UserPanelPopover.tsx

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
- **Session Hash:** 4j0wbhcp2cpoyi8oefex
- **Created:** 2026-01-28

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

- 2026-01-28: Resume work to move default credential selection into manage dialogs (remove list dropdowns) for account and repo views; update modal state, i18n, and tests.

- 2026-01-28: UserPanelPopover already includes new default-related state/logic, but modal UI and list dropdown removal still pending in current file view.

- 2026-01-28: UserPanelPopover still renders default Select dropdowns in list view and has modal comment saying defaults live in list; modal needs switch and list dropdowns removed.

- 2026-01-28: RepoDetailPage still shows default Select dropdowns for repo and model credentials; modal logic still expects defaults set from list view.

- 2026-01-28: RepoDetailPage needs modal updates for repo/model credential defaults; current submit functions still send null id for new profiles, so default-on-create requires generated id.

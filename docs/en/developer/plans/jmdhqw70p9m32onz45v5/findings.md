# Findings & Decisions: Repo list creator + pull method UX + repo detail tasks
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. jmdhqw70p9m32onz45v5 */}

## Session Metadata
- **Session Hash:** jmdhqw70p9m32onz45v5
- **Created:** 2026-03-05

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Repo cards: show the repo creator (创建人) and remove the redundant bottom-right “Manage” action (cards are already clickable).
- Repo robot form: “Check workflow/pull mode” must work without forcing a “save robot first” roundtrip; selecting credentials should be enough to validate.
- Repo detail: show tasks + task groups related to this repo (similar to the global Tasks/Task Groups lists).
- Repo onboarding wizard: clarify where completion is stored and stop re-opening the wizard when the repo is already configured.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `frontend/src/pages/ReposPage.tsx` renders clickable `.hc-modern-card` items and still shows a “Manage” button that just navigates to the same detail page.
- Repo “workflow mode” (auto/direct/fork) UI lives in `frontend/src/pages/RepoDetailPage.tsx` and currently blocks “Check workflow” unless `editingRobot.id` exists (toast key `repos.robotForm.workflowMode.saveRequired`).
- Backend already supports saved-robot workflow checks via `POST /repos/:id/robots/:robotId/workflow/test` in `backend/src/modules/repositories/repositories.controller.ts`; it resolves provider tokens via `resolveRobotProviderToken` (`backend/src/services/repoRobotAccess.ts`).
- Repo DB rows do not store `createdBy`, but repo creation seeds an owner membership (`RepoMember` role=`owner`) in `RepositoriesController#create` → `RepoMemberService#addMember`, so “creator” can be derived from the earliest owner membership.
- Repo overview already shows tasks via `RepoTaskActivityCard` (stats + recent tasks), but does not list task groups. Task-group list API already supports filtering by `repoId` (`frontend/src/api/taskGroups.ts`), but the router and TaskGroupsPage do not yet expose a repoId query param.
- Repo onboarding completion is currently stored in frontend localStorage under `hookcode-repo-onboarding:<repoId>` (`frontend/src/pages/RepoDetailPage.tsx`).
- Repo detail now skips rendering the onboarding wizard when a repo already has robots/webhook verification, even if localStorage is empty (prevents repeated redirects/flashes).

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Expose `repo.creator` in `GET /repos/:id` | ReposPage already fetches repo detail per card for summary data, so adding creator there avoids extra requests. |
| Add `POST /repos/:id/workflow/test` (draft) | Enables workflow validation using selected credentials without saving a robot. |
| Add repoId support to task-group list route | Needed to deep-link “View all task groups for this repo” from repo detail. |
| Auto-dismiss onboarding when a repo already has robots | Makes onboarding consistent across devices/cleared storage and aligns with “already configured” user expectation. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| `bash` is not available in the environment | Used the template-copy approach for plan initialization (via `sh` + `python3`) instead of the bash init script. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `frontend/src/pages/ReposPage.tsx` (repo cards)
- `frontend/src/pages/RepoDetailPage.tsx` (robot form + onboarding + overview)
- `frontend/src/components/repos/RepoTaskActivityCard.tsx` (repo-scoped tasks visibility)
- `backend/src/modules/repositories/repositories.controller.ts` (repo APIs, workflow test)
- `backend/src/modules/repositories/repo-member.service.ts` (owner memberships; derive creator)

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

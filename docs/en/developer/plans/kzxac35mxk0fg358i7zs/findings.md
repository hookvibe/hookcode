# Findings & Decisions: Repo panel provider activity row
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. kzxac35mxk0fg358i7zs -->

## Session Metadata
- **Session Hash:** kzxac35mxk0fg358i7zs
- **Created:** 2026-01-21

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
- Add a new dashboard row in the repo detail panel under the Basic section.
- In a single row, display recent: commit history, merge history (MR/PR), and issue titles.
- Public repositories should fetch activity without credentials (anonymous mode).
- Private repositories should require the user to pick a credential profile before fetching activity.
- UI must be i18n-ready and use Skeleton for loading states.

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
- `frontend/src/pages/RepoDetailPage.tsx` renders the Basic section as an AntD `Card` with a form.
- Repo onboarding already supports `credentialSource` (`anonymous`/`user`/`repo`) + `credentialProfileId` selection via `/repos/:id/provider-meta`.
- Backend `RepositoriesController#getProviderMeta` resolves provider tokens using `resolveRobotProviderToken` and supports anonymous mode for public repos.
- `GitlabService` and `GithubService` wrappers exist but need list APIs for commits/issues/merges to support the dashboard row.

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
| Add backend endpoint `GET /repos/:id/provider-activity` | Keeps provider data fetching server-side and avoids leaking tokens to frontend |
| Support `credentialSource` + `credentialProfileId` query params | Matches onboarding flow and enables “public direct / private choose credential” behavior |
| Implement a compact `RepoDetailProviderActivityRow` component under Basic card | Meets the “below Basic info” placement requirement with minimal layout churn |

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
- frontend/src/pages/RepoDetailPage.tsx
- frontend/src/components/repos/RepoOnboardingWizard.tsx (credential selection pattern)
- backend/src/modules/repositories/repositories.controller.ts (`/provider-meta` endpoint for visibility)
- backend/src/modules/git-providers/gitlab.service.ts, backend/src/modules/git-providers/github.service.ts

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

# Findings & Decisions: frontend repos onboarding wizard
<!-- 
  WHAT: Your knowledge base for the task. Stores everything you discover and decide.
  WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited.
  WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule).
-->

<!-- Link discoveries to code changes via this session hash. 58w1q3n5nr58flmempxe -->

## Session Metadata
- **Session Hash:** 58w1q3n5nr58flmempxe
- **Created:** 2026-01-17

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
- Repo creation/update must allow selecting `provider` (GitHub/GitLab) and entering `repo URL`.
- Repo create UX: after creating a repo, go directly to the repo detail onboarding wizard (do not show the webhook quickstart modal). 58w1q3n5nr58flmempxe
- Repo detail page should be full-width (remove `max-width: var(--hc-page-max)` constraint for this page).
- On first entry to repo detail page, show a skippable onboarding wizard (refactor old webhook-only logic):
  - Step 1: Fetch repo visibility (private/public) and explain submission options:
    - Private: only via authorized credentials.
    - Public: via authorized credentials OR fork flow.
    - Provide UI to select existing credential and/or create credential.
  - Step 2: Guide user to add a bot (instructions).
  - Step 3: Let user test the bot via a chat-style interaction.
  - Step 4: Ask whether to enable webhook; if yes guide configuration; warn when running on localhost that public network access is required.
  - Step 5: Completion screen confirming setup finished.
- After onboarding completion (or skip), user should land on the current repo detail page.
- URL validation guardrails: accept optional `.git` suffix and validate provider/host mismatch to prevent bad repo records (e.g. GitLab selected but GitHub URL entered). 58w1q3n5nr58flmempxe
- Visibility detection should happen automatically after entering the repo URL (reflected in onboarding; anonymous detection should still detect public repos when possible). 58w1q3n5nr58flmempxe

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
- Frontend has its own `frontend/AGENTS.md` requiring i18n for all new user-facing text and Skeleton loading UIs (AntD `Skeleton`). 58w1q3n5nr58flmempxe
- Existing frontend pages: `frontend/src/pages/ReposPage.tsx` (repo list + create modal) and `frontend/src/pages/RepoDetailPage.tsx` (tabs: basic/branches/credentials/robots/automation/webhooks). 58w1q3n5nr58flmempxe
- Global layout applies `.hc-page__body > * { max-width: var(--hc-page-max) }`; `styles.css` already contains a per-page override pattern (see `.hc-task-detail-page`) that can be reused for repo detail full-width. 58w1q3n5nr58flmempxe
- Backend currently blocks robot create/update/test/delete and automation update until `repo.webhookVerifiedAt` is set (409 `REPO_WEBHOOK_NOT_VERIFIED`), while `/chat` (manual trigger) does not require webhook verification. 58w1q3n5nr58flmempxe
- Repo create API already supports `externalId` + `apiBaseUrl` (in addition to `provider` + `name`), so a "repo URL" field can be parsed into these fields on the frontend. 58w1q3n5nr58flmempxe
- Current bug: `ReposPage` still opens `WebhookIntroModal` after creation; should navigate to `#/repos/:id` instead. 58w1q3n5nr58flmempxe
- Current limitation: backend `/repos/:id/provider-meta` rejects anonymous mode (returns `REPO_PROVIDER_TOKEN_REQUIRED`), which blocks "auto detect public/private without credentials". 58w1q3n5nr58flmempxe
- Dev noise: Vite proxy logs `ECONNREFUSED 127.0.0.1:4000` for `/api/events/stream` when backend is down; consider reducing reconnect spam or clarifying env config. 58w1q3n5nr58flmempxe

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
| Persist onboarding completion in `localStorage` per `repoId` | Frontend-only requirement; avoids DB schema changes and is sufficient for "first entry" UX. 58w1q3n5nr58flmempxe |
| Add `/repos/:id/provider-meta` endpoint for provider visibility | Repo visibility is not stored; onboarding needs a backend-mediated provider API call without exposing tokens to the browser. 58w1q3n5nr58flmempxe |
| Remove webhook verification gate for robots/automation | The new onboarding makes webhooks optional; robots + manual chat should work without webhooks. 58w1q3n5nr58flmempxe |
| Support anonymous visibility detection | Public repos can be detected without credentials; unknown remains for private/not-found to guide credential setup. 58w1q3n5nr58flmempxe |

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
- Frontend repo URL parsing: `frontend/src/utils/repoUrl.ts`
- Frontend onboarding wizard: `frontend/src/components/repos/RepoOnboardingWizard.tsx`
- Backend provider meta endpoint + webhook gating changes: `backend/src/modules/repositories/repositories.controller.ts`

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

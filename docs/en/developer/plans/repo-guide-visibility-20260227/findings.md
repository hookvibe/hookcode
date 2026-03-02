# Findings & Decisions: Fix repo-level config missing in bot setup



# Findings & Decisions: Fix repo-level config missing in bot setup
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. repo-guide-visibility-20260227 */}

## Session Metadata
- **Session Hash:** repo-guide-visibility-20260227
- **Created:** 2026-02-27

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Fix the add-bot flow so required repo-level visibility/credential configuration (including model config like codex) is available and can be set.
- Remove the dead-end where bot creation fails because repo-level config is missing in the add-bot UI.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- User reports the repo onboarding guide shows repo-level visibility/credential settings, but the add-bot flow omits repo-level settings needed for model config, preventing creation.
- Repo onboarding wizard and robot creation modal both live in `frontend/src/pages/RepoDetailPage.tsx`, with dedicated onboarding components under `frontend/src/components/repos/onboarding/`.
- The onboarding "Visibility & credentials" step is implemented in `frontend/src/components/repos/onboarding/RepoOnboardingVisibilityStep.tsx` and the bot step in `frontend/src/components/repos/onboarding/RepoOnboardingRobotStep.tsx`.
- `RepoOnboardingWizard` only renders a simple "Create bot" CTA in the bot step; it does not expose repo-level model credential configuration within onboarding.
- The robot modal in `frontend/src/pages/RepoDetailPage.tsx` supports model credential sources `user`, `repo`, and `robot`, but when `repo` is selected it only shows a status alert (configured/not configured) with no inline setup path.
- Repo-level model credentials are managed in the repo detail "Credentials" tab via a card with an "Add" button that opens the model credential modal (`startEditModelProfile` in `frontend/src/pages/RepoDetailPage.tsx`).
- Existing frontend tests in `frontend/src/tests/repoDetailPage.test.tsx` cover onboarding wizard visibility and robot modal behaviors, but none target repo-scoped model credential setup actions.
- Robot form model credential copy lives in `frontend/src/i18n/messages/en-US/repos.ts` and `frontend/src/i18n/messages/zh-CN/repos.ts` alongside other `repos.robotForm.modelCredential.*` strings.

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
- docs/en/developer/plans/repo-guide-visibility-20260227/task_plan.md
- frontend/src/pages/RepoDetailPage.tsx
- frontend/src/components/repos/onboarding/RepoOnboardingVisibilityStep.tsx
- frontend/src/components/repos/onboarding/RepoOnboardingRobotStep.tsx
- frontend/src/components/repos/RepoOnboardingWizard.tsx
- frontend/src/pages/RepoDetailPage.tsx

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-
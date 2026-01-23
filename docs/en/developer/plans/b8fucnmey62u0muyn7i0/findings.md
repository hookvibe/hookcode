# Findings & Decisions: Dynamic models by credential
{/* Translate remaining Chinese content to English for docs/en consistency. docsentrans20260121 */}
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. b8fucnmey62u0muyn7i0 */}

## Session Metadata
- **Session Hash:** b8fucnmey62u0muyn7i0
- **Created:** 2026-01-21

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- When creating/editing LLM credentials, provide the ability to view/select executable models (prefer dynamic querying).{/* Capture dynamic model list requirement. b8fucnmey62u0muyn7i0 */}
- In repo review-related configuration, also show available models based on the selected credential to avoid hardcoding.
- In bot credential/bot configuration, also provide available model list display/selection.
- If a provider cannot offer a model-list API, use a built-in model allowlist as a fallback (without affecting other providers' dynamic capability).

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The currently supported model provider keys are: `codex` / `claude_code` / `gemini_cli`, and the backend execution path branches explicitly on them (see `backend/src/agent/agent.ts`).{/* Record provider keys and execution mapping. b8fucnmey62u0muyn7i0 */}
- The frontend account-level credentials panel is in `frontend/src/components/UserPanelPopover.tsx`, and includes profiles for the three providers.
- The frontend repo detail page is in `frontend/src/pages/RepoDetailPage.tsx`, contains repo-level credentials and bot model configuration, and currently hardcodes default models (e.g. `gpt-5.2` / `claude-sonnet-4-5-20250929` / `gemini-2.5-pro`).
- Backend provider default models are also hardcoded in each provider module (e.g. `backend/src/modelProviders/claudeCode.ts` / `geminiCli.ts`).
- Implemented model discovery endpoints: account-level `POST /users/me/model-credentials/models`, repo-level `POST /repos/:id/model-credentials/models`, with a reusable frontend picker (`ModelProviderModelsButton`).{/* Record implemented API entrypoints and UI integration. b8fucnmey62u0muyn7i0 */}
- The “Available models” UI strings map to `modelCatalog.*` and the picker is rendered in `frontend/src/components/ModelProviderModelsButton.tsx`, with usage in `frontend/src/pages/RepoDetailPage.tsx` and `frontend/src/components/UserPanelPopover.tsx`.{/* Capture model catalog component locations. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- Additional scope-specific instructions live in `frontend/AGENTS.md` and `backend/AGENTS.md`, with test-specific rules in `frontend/src/tests/AGENTS.md` and `backend/src/tests/AGENTS.md`.{/* Note nested AGENTS instructions for compliance. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- `ModelProviderModelsButton` only wires click behavior when `onPickModel` is provided; otherwise it renders a static list, so missing handler wiring in parent components would explain clicks not applying models.{/* Capture picker click dependency. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- In `frontend/src/pages/RepoDetailPage.tsx`, the model catalog button under repo credential editing omits `onPickModel`, so the list is non-interactive even though the UI suggests clicking applies a model.{/* Note missing onPickModel in repo credential editor. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The robot config section in `frontend/src/pages/RepoDetailPage.tsx` does pass `onPickModel`, implying click-to-apply works there, so the bug is likely limited to other credential forms.{/* Contrast robot config behavior with repo credential editor. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The account-level credentials modal in `frontend/src/components/UserPanelPopover.tsx` also omits `onPickModel`, and the surrounding form appears to only capture credential fields (no obvious model input), so clicks cannot apply a model there either.{/* Note missing onPickModel in user credential modal. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The repo-scoped model credential editor (`modelProfileForm`) only collects remark/api key/base URL, with no model field in the form state, indicating the model list there is informational only.{/* Confirm repo credential form lacks model field. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The only place `onPickModel` is wired is the robot configuration model field in `frontend/src/pages/RepoDetailPage.tsx`, and that field wraps `Input` + `ModelProviderModelsButton` inside `Space.Compact` under a `Form.Item` with `name` set.{/* Locate the single interactive picker usage and its layout. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- Existing progress logs show previous model picker work was tested and delivered, but Phase 6 (bugfix) needs new verification entries once the click-to-apply issue is corrected.{/* Sync plan/progress awareness for new bugfix phase. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- Frontend tests live in `frontend/src/tests/repoDetailPage.test.tsx`, which already mocks `listRepoModelProviderModels`, making it the likely place to add coverage for the model picker click-to-apply behavior.{/* Identify test file for model picker coverage. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The robot modal is opened from the Robots tab via the `repos.robots.createRobot` button (visible when the repo is not archived), which can be used in tests to reach the model picker UI.{/* Note test path to open robot modal. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- `buildRobotInitialValues` defaults `modelProviderConfig.credentialSource` to `user` and sets a default model per provider, so tests for the picker should mock `listMyModelProviderModels` and expect the model input to update from its default value.{/* Record default credential source behavior for robot form. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The codebase does not currently use `Form.ErrorList`, so fixing the picker binding should avoid introducing new AntD deprecation warnings (e.g., `Input` addonAfter) by staying with `Space.Compact` and a bound custom control.{/* Note design constraint for form binding fix. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The change log uses `docs/en/change-log/0.0.0.md` for unreleased entries, so the bugfix is recorded there with the session hash and plan link.{/* Capture changelog placement requirement. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}
- The new `ModelPickerField` helper and robot model field wiring live near the top and robot form sections of `frontend/src/pages/RepoDetailPage.tsx`, and the picker test sits in `frontend/src/tests/repoDetailPage.test.tsx`, which are the main locations to reference for this fix.{/* Note primary code locations for the bugfix. docs/en/developer/plans/b8fucnmey62u0muyn7i0/task_plan.md b8fucnmey62u0muyn7i0 */}

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Implement a backend API to fetch models by credential (server-side proxy request) | Does not expose secrets to the frontend, and centralizes caching/fallback policy for maintainability |
| Split the API into user-level and repo-level entrypoints (`/users/me/...` + `/repos/:id/...`) | Matches the two scenarios (account credentials vs repo & bot configuration) and reduces cross-module coupling |{/* Document API split decision. b8fucnmey62u0muyn7i0 */}
| Relax the Codex model field from a strict union to "any non-empty string" | Supports dynamic model lists and future model evolution, avoiding a hardcoded union that forces fallback to defaults |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- backend/src/agent/agent.ts
- backend/src/modelProviders/codex.ts
- backend/src/modelProviders/claudeCode.ts
- backend/src/modelProviders/geminiCli.ts
- backend/src/services/modelProviderModels.ts
- backend/src/modules/common/dto/model-provider-models.dto.ts
- frontend/src/components/UserPanelPopover.tsx
- frontend/src/components/ModelProviderModelsButton.tsx
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

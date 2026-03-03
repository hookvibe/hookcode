# Findings & Decisions: Add preview port placeholders and repo env injection



# Findings & Decisions: Add preview port placeholders and repo env injection
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. preview-env-config-20260302 */}

## Session Metadata
- **Session Hash:** preview-env-config-20260302
- **Created:** 2026-03-02

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Support `{{PORT:frontend}}` / `{{PORT:backend}}` placeholders for preview-only dev servers.
- Keep strict ban on fixed preview ports; ports must be system-assigned.
- Add repo detail UI for env injection; secrets must not be stored in code.
- Block reserved system env keys from repo injection (e.g., `PORT`).
 - Treat all repo preview env values as secrets by default (no secret toggle; hide after save). docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
{/* Logged skill and config references to follow. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 */}
- Preview instances are started in `backend/src/modules/tasks/preview.service.ts` and currently allocate ports per instance.
- Preview env validation lives in `backend/src/services/hookcodeConfigService.ts` + `backend/src/utils/previewEnv.ts`.
- Repo detail UI is implemented in `frontend/src/pages/RepoDetailPage.tsx`.
- Repository update API is `PATCH /repos/:id` in `backend/src/modules/repositories/repositories.controller.ts`.
- Repository table stores JSON credential fields but no env-config storage yet (`backend/prisma/schema.prisma`).
- `.hookcode.yml` generator skill expects pnpm install at repo root and preview instances under `preview.instances`.
- Hookcode config reference documents blocked characters for install commands and placeholder behavior.
{/* Note pending UI wiring + env file observations. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 */}
- `frontend/src/pages/RepoDetailPage.tsx` does not yet render the new preview env tab or store `previewEnvConfig`.
- `frontend/.env` and `backend/.env` contain non-default dev ports and secrets; `.hookcode.yml` must avoid fixed ports and avoid committing sensitive DB credentials.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Use instance-name placeholders (`{{PORT:<name>}}`) resolved from preview config. | Matches user choice and avoids order confusion. |
| Store repo env vars on the Repository record as JSON with secret redaction. | Keeps secrets out of code while fitting existing repo update flow. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| `docs.json missing navigation.languages[]` from init-session script | Logged and continued since planning files were created. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
{/* Log skill reference files for traceability. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 */}
- `backend/src/modules/tasks/preview.service.ts`
- `backend/src/utils/previewEnv.ts`
- `backend/src/services/hookcodeConfigService.ts`
- `backend/src/modules/repositories/repositories.controller.ts`
- `backend/src/modules/repositories/repository.service.ts`
- `backend/prisma/schema.prisma`
- `frontend/src/pages/RepoDetailPage.tsx`
- `docs/en/user-docs/config/hookcode-yml.md`
 - `.codex/skills/hookcode-yml-generator/references/hookcode-yml-logic.md`
 - `.codex/skills/hookcode-yml-generator/SKILL.md`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- No visual or browser content used; findings derived from repository files.

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

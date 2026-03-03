# Findings & Decisions: Update hookcode.yml for preview ports



# Findings & Decisions: Update hookcode.yml for preview ports
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. hookcode-yml-update */}

## Session Metadata
- **Session Hash:** hookcode-yml-update
- **Created:** 2026-03-02

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Update `.hookcode.yml` to install dependencies and run preview servers.
- Ensure frontend and backend ports are system-assigned and passed to the dev servers.
- Use the existing `backend/.env` database connection (remote DB) during backend preview.
- Mirror non-default values from `frontend/.env` and `backend/.env` into preview env settings.
- Add a mechanism to reference multiple preview ports (frontend/backend) in env values.
- Add a repo detail UI to inject env variables securely (no plaintext secrets committed), excluding reserved system vars (e.g., `PORT`).

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- `.hookcode.yml` supports `preview.instances[].env`, and keys ending with `PORT` must use `{{PORT}}`.
- Preview env values with fixed ports (e.g., `:4020`) are rejected by validation.
- HookCode injects `PORT` and `HOST=127.0.0.1` into preview commands.
- Backend `dotenv.config()` loads `backend/.env` when the preview workdir is `backend`.
- Non-default frontend env keys: `HOOKCODE_FRONTEND_PORT`, `VITE_API_BASE_URL`.
- Non-default backend env keys: `PORT`, `TASK_LOGS_ENABLED`, `ADMIN_TOOLS_ENABLED`, `INLINE_WORKER_ENABLED`, `DATABASE_URL`, `DATABASE_URL_TEST`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `HOOKCODE_TASK_GROUPS_ROOT`.
- Preview env validation blocks fixed-port DB settings (`DATABASE_URL`, `DB_PORT`), so those must remain in `backend/.env`.
- Repo detail UI lives in `frontend/src/pages/RepoDetailPage.tsx` with sidebar navigation.
- Repo APIs are in `backend/src/modules/repositories/repositories.controller.ts`.
- `Repository` table already stores JSON fields for repo-scoped credentials (`repoProviderCredentials`, `modelProviderCredentials`) but no dedicated env/secret storage yet.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Add a backend preview instance with `env.PORT={{PORT}}`. | Prevents `backend/.env` from forcing a fixed port while keeping the remote DB settings. |
| Keep frontend command with `--port {{PORT}}`. | Vite reads the CLI port flag for dynamic port assignment. |
| Mirror only non-default env values into `.hookcode.yml` env blocks. | Matches the requirement to load overrides without duplicating defaults. |
| Replace fixed port values in preview env with placeholders or relative paths. | Required to satisfy preview validation and system-assigned port rules. |
| Leave DB URL/port settings in `backend/.env` instead of `.hookcode.yml`. | Preview env validation rejects fixed-port DB values, but dotenv will still load them for the backend process. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| `init-session.sh` reported missing `docs.json` navigation languages. | Continued because plan files were created successfully. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `.hookcode.yml`
- `backend/src/services/hookcodeConfigService.ts`
- `backend/src/utils/previewEnv.ts`
- `backend/.env`
- `backend/.env.example`
- `frontend/package.json`
- `frontend/.env`
- `frontend/.env.example`
- `backend/package.json`

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- No visual or browser content used; findings derived from repository files.

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

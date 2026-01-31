# Findings & Decisions: Create hookcode.yml skill
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. hookcode-yml-skill-20260129 */}

## Session Metadata
- **Session Hash:** hookcode-yml-skill-20260129
- **Created:** 2026-01-29

## Requirements
- Collect repo locations and logic tied to `.hookcode.yml` (dependency install + preview/dev flows).
- Create a new skill under `/skill` that guides generating `.hookcode.yml` for this repo.
- Include references to the key code/docs that define the config behavior.

## Research Findings
- `.hookcode.yml` parsing + validation: `backend/src/services/hookcodeConfigService.ts` reads `<workspace>/.hookcode.yml` and throws on invalid config.
- Dependency schema/types: `backend/src/types/dependency.ts`; installs + validation live in `backend/src/agent/dependencyInstaller.ts`, wired in `backend/src/modules/tasks/tasks.module.ts`.
- Preview integration: `backend/src/modules/tasks/preview.service.ts` reads `.hookcode.yml`, restarts previews on changes, and skips reloads on invalid config.
- Frontend surfaces config/preview errors and dependency override messaging in `frontend/src/pages/RepoDetailPage.tsx` + i18n files.
- User docs for `.hookcode.yml`: `docs/en/user-docs/config/hookcode-yml.md`, with preview references in `docs/en/user-docs/preview.md` and overrides in `docs/en/user-docs/config/robots.md`.
- `.hookcode.yml` schema highlights: `version: 1`; optional `dependency` with `failureMode` (`soft` default/`hard`), `runtimes` (max 5) each with `language` (node/python/java/ruby/go), optional `version`, `install`, and `workdir`.
- Preview schema: `preview.instances` (1–5) with unique `name`, `command`, `workdir`, optional `port`, and optional `readyPattern`.
- Dependency installer enforces relative `workdir` within repo, blocks invalid install commands, and honors `failureMode` (hard/soft) when runtime missing or install fails.
- Preview service watches `.hookcode.yml` via fs watcher, debounces reloads, and logs “config reload skipped” messages when config is invalid or preview is not configured.
- `.hookcode.yml` docs specify allowlisted install command patterns per language, blocked shell characters, and execution order (checkout → read config → runtime validation → installs → AI analysis).
- Preview docs emphasize TaskGroup preview prerequisites, log diagnostics, idle timeout (30 minutes), and automatic restart on `.hookcode.yml` edits.
- Skill creation scripts are available at `/Users/gaoruicheng/.codex/skills/.system/skill-creator/scripts/` (`init_skill.py`, `package_skill.py`, `quick_validate.py`).
- Root `package.json` uses pnpm workspaces and defines `dev:frontend` (`pnpm --filter hookcode-frontend dev`) plus a combined `dev` script via `concurrently`.
- Frontend dev server script is `vite` (`frontend/package.json` → `dev: vite`), making it a likely preview command when `workdir: frontend`.
- Robot config can override `.hookcode.yml` dependency installs via `enabled`, `failureMode`, and `allowCustomInstall` (`docs/en/user-docs/config/robots.md`).
- Reviewed generated skill files and normalized content to ASCII-only wording per repo guidance.
- Verified no remaining non-ASCII characters in new skill files and updated local plan comments accordingly.
- Verified the generated template and confirmed no TODO placeholders remain in the skill folder.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Capture the above files in skill references | Keeps the skill grounded in actual repo behavior and reduces drift |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Full-disk `find /Users/gaoruicheng -name init_skill.py` timed out | Plan to limit search scope to `~/.codex` or specific tool directories |

## Resources
- backend/src/services/hookcodeConfigService.ts
- backend/src/types/dependency.ts
- backend/src/agent/dependencyInstaller.ts
- backend/src/modules/tasks/preview.service.ts
- backend/src/modules/tasks/tasks.module.ts
- frontend/src/pages/RepoDetailPage.tsx
- frontend/src/i18n/messages/en-US.ts
- frontend/src/i18n/messages/zh-CN.ts
- docs/en/user-docs/config/hookcode-yml.md
- docs/en/user-docs/preview.md
- docs/en/user-docs/config/robots.md

## Visual/Browser Findings
- N/A (no images or external browser views)

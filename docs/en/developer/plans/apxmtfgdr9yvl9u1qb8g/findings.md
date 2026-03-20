# Findings & Decisions: repo-identification-overview
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}
{/* Keep the recorder findings template single-pass so new sessions do not duplicate sections. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320 */}

{/* Link discoveries to code changes via this session hash. apxmtfgdr9yvl9u1qb8g */}

## Session Metadata
- **Session Hash:** apxmtfgdr9yvl9u1qb8g
- **Created:** 2026-03-20

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Identify the current HookCode project before the user requests follow-up modifications.
- Summarize repository structure, major components, and likely change surfaces.
- Keep the response concise and grounded in the actual repository state.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The planning session hash is `apxmtfgdr9yvl9u1qb8g`, initialized via `.codex/agents/planning-recorder/scripts/init-session.sh`.
- The generated `task_plan.md` and `findings.md` templates required immediate population because they were still placeholders after initialization.
- The repository root is a `pnpm` monorepo with top-level application folders including `frontend`, `backend`, `docs`, `worker`, `shared`, `docker`, and `example`.
- Root-level project control files include `package.json`, `pnpm-workspace.yaml`, `README.md`, `README-zh-CN.md`, and `.hookcode.yml`.
- The root package version is `0.0.1`, the package manager is `pnpm@9.6.0`, and the repository expects Node.js `>=18.0.0`.
- Workspace packages are limited to `backend`, `frontend`, and `docs`; `worker` and `shared` exist in the repo but are not standalone workspace packages.
- Root scripts emphasize local development (`pnpm dev`, `dev:backend`, `dev:frontend`, `dev:db`), docs build, database workflows, and per-package build/test commands.
- The README describes HookCode as a webhook-triggered AI code review and automation platform supporting GitHub/GitLab plus multiple CLI coding assistants (Claude Code, Codex, Gemini).
- `backend/package.json` shows a NestJS backend with Prisma, Postgres (`pg`), Swagger support, mail support, YAML parsing, and SDK integrations for Claude, Codex, and Gemini.
- Backend package metadata is now verified: it is a TypeScript-compiled NestJS service that runs Prisma generation during build and depends on multiple model/tool runtimes plus `@hookvibe/hookcode-worker`.
- `frontend/package.json` shows a React 18 + Vite frontend using Ant Design, `axios`, markdown rendering, ECharts, and Vitest-based tests.
- The backend source tree includes modules for auth, agent execution, config, cost governance, model providers, policy engine, provider routing, services, and admin tools.
- The frontend source tree includes API clients, components, hooks, i18n, pages, theme/styles, and test utilities, which suggests a console-style SPA.
- `backend/src/main.ts` boots the HTTP server through `bootstrapHttpServer({ rootModule: AppModule })`, so `AppModule` and `bootstrap.ts` are the primary backend entry wiring files.
- `frontend/src/main.tsx` mounts a React SPA with Ant Design providers and delegates application routing/state composition to `frontend/src/App.tsx`.
- The backend file list shows rich HTTP modules for auth, events, git providers, health, logs, cost governance, and additional task/repository workflows deeper in `backend/src/modules`.
- The frontend file list shows a console focused on repositories, tasks, approvals, automation, logs, notifications, and onboarding flows.
- `backend/src/app.module.ts` acts as the backend composition root and imports modules for auth, repositories, tasks, webhook intake, tools, skills, logs, notifications, workers, and cost governance.
- Backend composition is now confirmed at the top level: `AppModule` aggregates auth, repositories, tasks, webhook, skills, logs, notifications, workers, cost governance, tools, system, health, and OpenAPI-related modules.
- `frontend/src/App.tsx` confirms the frontend is a hash-routed SPA with theme persistence, locale handling, and a central `AppShell` page composition.
- `docs/package.json` shows the docs site is a separate Mintlify package, so user-facing documentation changes likely touch `docs/` independently from app code.
- Docs package metadata is now verified: the docs site is a separate Mintlify package with a validate-based build flow.
- `backend/prisma/schema.prisma` confirms PostgreSQL via `DATABASE_URL` and shows the product centers around tasks, task groups, repositories, approvals, workers, policies, budgets, quota events, and usage rollups.
- Backend persistence is confirmed as Prisma over PostgreSQL, with first-class tables for task orchestration, approvals, policy control, and cost-governance rollups.
- `.hookcode.yml` defines repo automation/preview behavior, including dependency installation with `pnpm`, a frontend webview preview, and a backend terminal preview with environment overrides.
- The `worker/` directory contains its own `src` and compiled `dist`, while `shared/preview-bridge.js` suggests a lightweight shared runtime bridge used by preview flows.
- `backend/src/bootstrap.ts` shows operational concerns handled at startup: schema bootstrap, CORS, `/api` prefixing, raw-body webhook parsing, OpenAPI generation, audit/system logs, runtime detection, worker version policy, and stale-task recovery.
- `frontend/src/pages/AppShell.tsx` shows the main console shell handles auth gating, notification/user panels, responsive sidebar behavior, and lazy-loaded pages for repos, tasks, task groups, archive, skills, and settings.
- Frontend shell routing is now confirmed at the top level: `AppShell` gates auth, lazy-loads the major pages, and uses Ant Design `Drawer` plus custom components around a hash-route state model.
- The frontend dependency stack is confirmed as Vite + React 18 with Ant Design, Ant Design X, Axios, ECharts, `react-markdown`, diff rendering, `react-window`, and Vitest plus Testing Library.
- The working tree already contains unrelated documentation/planning changes (`docs/docs.json` and another planning session), so follow-up implementation should avoid overwriting those files blindly.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Record discoveries before broader repository inspection. | This keeps the session trace aligned with the 2-action rule and avoids losing context. |
| Use `README.md` plus package manifests as the primary project-identification sources. | These files define the intended product scope, runtime assumptions, and operator workflows. |
| Treat `backend/src` and `frontend/src` as the main future modification surfaces. | Those directories contain the application source, while generated `dist` content is build output. |
| Track `docs/` as a separate modification surface for API and user-facing updates. | The repository keeps docs as its own package and the project instructions require doc validation after behavior changes. |
| Include `.hookcode.yml`, `backend/prisma`, and `worker/` in the project overview. | These areas define execution environment behavior, persistence, and task processing boundaries beyond the main UI/API code. |
| Inspect the database schema and package manifests after mapping the backend/frontend composition roots. | This gives the next summary pass a practical stack and domain-model view instead of only module names. |
| Prepare the user-facing identification summary around architecture, stack, and change entry points. | The user asked for project recognition to support later modification requests, so the summary should optimize for practical orientation. |
| Close the discovery loop with a concise architecture map and modification hotspots. | The backend/docs manifests confirmed the remaining stack details needed for a practical handoff summary. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| Planning recorder interaction is only partially automatable in the current tool session. | Initialized the session via the provided script and continued by updating the generated planning files directly to keep the required records current. |
| The repository is not clean before this task starts. | Treat existing `git status` changes as unrelated unless they overlap with future requested modifications. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- docs/en/developer/plans/apxmtfgdr9yvl9u1qb8g/task_plan.md
- docs/en/developer/plans/apxmtfgdr9yvl9u1qb8g/findings.md
- .codex/agents/planning-recorder/scripts/init-session.sh
- package.json
- pnpm-workspace.yaml
- README.md
- backend/package.json
- frontend/package.json
- docs/package.json
- backend/src
- frontend/src
- backend/src/main.ts
- backend/src/app.module.ts
- frontend/src/main.tsx
- frontend/src/App.tsx
- docs/package.json
- backend/prisma/schema.prisma
- .hookcode.yml
- worker/src
- shared/preview-bridge.js
- backend/src/bootstrap.ts
- frontend/src/pages/AppShell.tsx

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

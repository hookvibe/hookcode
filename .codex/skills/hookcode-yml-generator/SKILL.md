---
name: hookcode-yml-generator
description: Generate or update a repo-specific `.hookcode.yml` for this HookCode monorepo. Use when asked to create, modify, or validate `.hookcode.yml` (dependency installs, preview instances, dev commands, or failure modes) for this repository.
tags:
  - config
  - yaml
  - preview
---
<!-- Sync hookcode-yml-generator workflow with current .hookcode.yml parser/runtime behavior. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 -->

# Hookcode Yml Generator

## Overview

Generate a valid `.hookcode.yml` tailored to this repository's dependency install workflow and preview dev-server setup, using the latest parser/runtime rules (`display`, named `{{PORT:<instance>}}`, and no fixed local ports).

## Workflow

1. Read `references/hookcode-yml-logic.md` for schema rules, allowlists, and preview behavior.
2. Confirm repo scripts:
   - Root `package.json` uses pnpm workspaces and exposes `dev:frontend` and `dev`.
   - `frontend/package.json` uses `vite` for `dev`.
3. Build the dependency section:
   - Use `version: 1`.
   - Prefer `failureMode: soft` unless the user explicitly wants hard failure.
   - Add one Node runtime with `install: "pnpm install --frozen-lockfile"` at repo root (workdir optional).
4. Build the preview section:
   - Define 1-5 `preview.instances` entries with unique `name` values.
   - For frontend, prefer:
     - `name: frontend`
     - `workdir: "frontend"`
     - `command: "pnpm dev --host 127.0.0.1 --port {{PORT:frontend}}"`
     - `display: webview`
     - `readyPattern: "Local:"`
   - For backend (optional), prefer:
     - `name: backend`
     - `workdir: "backend"`
     - `command: "pnpm run prisma:generate && pnpm exec nest start"`
     - `display: terminal`
     - `env.PORT: "{{PORT:backend}}"`
   - Do not use `port:` in preview instances (unsupported by schema).
   - Do not use the deprecated `-- --port` CLI pattern.
5. Validate constraints:
   - `workdir` is relative and inside the repo.
   - No blocked shell characters in install commands.
   - Max 5 runtimes and 5 preview instances.
   - Any env key ending with `PORT` must use `{{PORT}}` or `{{PORT:<instance>}}`.
   - Loopback URLs such as `localhost`, `127.0.0.1`, `0.0.0.0`, and `::1` must not hardcode numeric ports.
   - Named placeholders must reference defined preview instance names.
6. Output `.hookcode.yml` at repo root and list assumptions (e.g., pnpm workspace install).

## Quick Start Template

Copy `assets/hookcode.yml.template` to `<repo-root>/.hookcode.yml`, then adjust if the user wants different commands, additional runtimes, or multiple preview instances.

## Project Defaults (Recommended)

- Package manager: pnpm workspace install from repo root.
- Runtime: Node (engine >= 18 from `package.json`).
- Preview: Vite frontend in `frontend/` and optional backend preview in `backend/`.

## Output Checklist

- `.hookcode.yml` includes `version: 1`.
- Dependency install command is allowlisted and uses pnpm.
- Preview instances use explicit `display` modes (`webview` for frontend, `terminal` for backend when enabled).
- Preview command/env values do not hardcode local fixed ports and do not include deprecated `port:` fields.
- Placeholder usage is valid (`{{PORT}}` and `{{PORT:<instance>}}` target defined instances).
- Notes mention robot overrides can change dependency behavior.

---
name: hookcode-yml-generator
description: Generate or update a repo-specific `.hookcode.yml` for this HookCode monorepo. Use when asked to create, modify, or validate `.hookcode.yml` (dependency installs, preview instances, dev commands, or failure modes) for this repository.
---

# Hookcode Yml Generator

<!-- Guide generating repo-specific .hookcode.yml using the audited config behavior. docs/en/developer/plans/hookcode-yml-skill-20260129/task_plan.md hookcode-yml-skill-20260129 -->

## Overview

Generate a valid `.hookcode.yml` tailored to this repository's dependency install workflow and preview dev server setup.

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
   - Add one instance named `frontend`.
   - Set `workdir: "frontend"` and `command: "pnpm dev"`.
   - Optionally add `readyPattern: "Local:"` and `port: 5173` for clarity.
5. Validate constraints:
   - `workdir` is relative and inside the repo.
   - No blocked shell characters in install commands.
   - Max 5 runtimes and 5 preview instances.
6. Output `.hookcode.yml` at repo root and list assumptions (e.g., pnpm workspace install).

## Quick Start Template

Copy `assets/hookcode.yml.template` to `<repo-root>/.hookcode.yml`, then adjust if the user wants different commands, additional runtimes, or multiple preview instances.

## Project Defaults (Recommended)

- Package manager: pnpm workspace install from repo root.
- Runtime: Node (engine >= 18 from `package.json`).
- Preview: Vite frontend in `frontend/`.

## Output Checklist

- `.hookcode.yml` includes `version: 1`.
- Dependency install command is allowlisted and uses pnpm.
- Preview instance `frontend` runs in `frontend/` with `pnpm dev`.
- Notes mention robot overrides can change dependency behavior.

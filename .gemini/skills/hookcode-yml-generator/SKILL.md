---
name: hookcode-yml-generator
description: Generate or update `.hookcode.yml` for the HookCode monorepo. Configures dependency installation, preview instances, and dev commands.
---

# Hookcode Yml Generator (Gemini)

## Overview

Use this skill to create or refine the `.hookcode.yml` configuration file for repositories managed by HookCode.

## Workflow

1.  **Analyze Repo:** Check `package.json` for runtimes and dev scripts.
2.  **Define Dependencies:** Set `version: 1`, `failureMode: soft`, and pnpm install commands.
3.  **Define Previews:** Configure instance names (e.g., `frontend`), `workdir`, and `command`.
4.  **Validate:** Ensure paths are relative and commands are safe.
5.  **Generate:** Output the `.hookcode.yml` at the repository root.

## Default Template

```yaml
version: 1
dependency:
  failureMode: soft
  runtimes:
    - language: node
      install: "pnpm install --frozen-lockfile"
preview:
  instances:
    - name: frontend
      workdir: "frontend"
      command: "pnpm dev -- --port {{PORT}}"
      readyPattern: "Local:"
```

## Constraints
- Max 5 runtimes.
- Max 5 preview instances.
- Commands must be allowlisted (avoid complex piping).
# Hookcode.yml Logic Reference

<!-- Align hookcode-yml-generator reference rules with the latest parser/runtime behavior. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 -->

## Schema Summary (version 1)

- `version: 1`
- `dependency` (optional)
  - `failureMode`: `soft` (default) or `hard`
  - `runtimes`: up to 5 entries
    - `language`: `node | python | java | ruby | go`
    - `version`: optional dotted numeric string
    - `install`: optional command (<= 500 chars)
    - `workdir`: optional relative path inside repo
- `preview` (optional)
  - `instances`: 1-5 entries
    - `name`: unique string
    - `command`: required (<= 500 chars)
    - `workdir`: required relative path inside repo
    - `env`: optional key/value map
    - `readyPattern`: optional regex
    - `display`: optional enum (`webview` | `terminal`), defaults to `webview`
    - `port`: not supported (fixed ports are rejected by schema)

Preview validation rules:
- `preview.instances[].name` must be unique.
- `{{PORT:<instance>}}` placeholders must reference defined instance names.
- Env keys ending with `PORT` must include `{{PORT}}` or `{{PORT:<instance>}}`.
- Loopback URLs (for example `localhost:5173`, `127.0.0.1:5173`) cannot hardcode numeric ports.

## Dependency Install Behavior

- Config parsing/validation: `backend/src/services/hookcodeConfigService.ts`.
- Dependency execution: `backend/src/agent/dependencyInstaller.ts`.
- Workdir must be relative and inside repo; absolute or escaping paths are rejected.
- Failure modes:
  - `soft`: missing runtime or install failure logs and continues.
  - `hard`: missing runtime or install failure aborts with error.
- Execution order: checkout -> read `.hookcode.yml` -> runtime validation -> install commands -> AI analysis.

## Allowed Install Commands (Allowlist)

- Node: `npm ci`, `npm install`, `yarn install`, `pnpm install` (flags allowed)
- Python: `pip install -r requirements.txt`, `pip install -e .`, `poetry install`
- Java: `mvn dependency:resolve`, `gradle dependencies`
- Ruby: `bundle install`, `gem install bundler`
- Go: `go mod download`, `go mod tidy`

Blocked characters (always rejected):
- `; & | &#96; $ ( ) { }`

## Preview Behavior

- Config path: `<workspace>/.hookcode.yml`.
- Preview reloads on config changes (debounced) via watcher in `backend/src/modules/tasks/preview.service.ts`.
- Invalid config or missing preview config logs "config reload skipped".
- HookCode injects `PORT` and `HOST=127.0.0.1` for preview commands.
- HookCode also injects `BROWSER=none` for preview child processes.
- Command/env placeholders `{{PORT}}` and `{{PORT:<instance>}}` are resolved before spawn.
- Startup readiness uses `readyPattern` when present, otherwise port probing.
- Startup timeout is 5 minutes per preview instance.
- Idle previews stop after 30 minutes of inactivity.
- Hidden previews also auto-stop after 30 minutes to reclaim ports.

## Repo-Specific Defaults

- Root uses pnpm workspaces (`package.json`), Node engine >= 18.
- Frontend dev command is `vite` (`frontend/package.json`), so recommended frontend preview:
  - `workdir: "frontend"`
  - `command: "pnpm dev --host 127.0.0.1 --port {{PORT:frontend}}"`
  - `display: webview`
- Optional backend preview:
  - `workdir: "backend"`
  - `command: "pnpm run prisma:generate && pnpm exec nest start"`
  - `display: terminal`
  - `env.PORT: "{{PORT:backend}}"`
- Dependency install should run once at repo root:
  - `install: "pnpm install --frozen-lockfile"`

## Robot Overrides

Robots can override repository dependency installs:
- `enabled`: disable dependency installs
- `failureMode`: override `soft`/`hard`
- `allowCustomInstall`: allow commands outside allowlist (blocked characters still rejected)

## Useful Files

- `backend/src/services/hookcodeConfigService.ts`
- `backend/src/agent/dependencyInstaller.ts`
- `backend/src/modules/tasks/preview.service.ts`
- `backend/src/types/dependency.ts`
- `docs/en/user-docs/config/hookcode-yml.md`
- `docs/en/user-docs/preview.md`
- `docs/en/user-docs/config/robots.md`

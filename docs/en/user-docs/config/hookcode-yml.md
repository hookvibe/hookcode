---
title: .hookcode.yml Configuration
---

<!-- Document repository-level dependency + preview configuration. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

Use `.hookcode.yml` at the repository root to declare **dependency installs** and **preview dev-server instances** that HookCode should run after checkout and before AI analysis or preview startup.

## File location

```
<repo-root>/.hookcode.yml
```

## Basic example

```yaml
version: 1

dependency:
  failureMode: soft
  runtimes:
    - language: node
      install: "pnpm install --frozen-lockfile"
    - language: python
      install: "pip install -r requirements.txt"

preview:
  instances:
    - name: frontend
      command: "pnpm dev"
      workdir: "frontend"
      env:
        VITE_PUBLIC_ORIGIN: "http://127.0.0.1:{{PORT}}"
      readyPattern: "Local:"
```

## Schema (version 1)

```yaml
version: 1
dependency:
  failureMode: soft | hard
  runtimes:
    - language: node | python | java | ruby | go
      version: "3.11"      # optional, informational/compat check
      install: "<command>" # optional
      workdir: "backend"   # optional, relative to repo root
preview:
  instances:
    - name: "frontend"       # required, unique
      command: "pnpm dev"    # required
      workdir: "frontend"    # required, relative to repo root
      env:                   # optional, env overrides
        PORT: "{{PORT}}"
        VITE_PUBLIC_ORIGIN: "http://127.0.0.1:{{PORT}}"
      readyPattern: "Local:" # optional, readiness regex
```

<!-- Add preview configuration guidance for TaskGroup dev preview. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
## Preview configuration

Use `preview.instances` to describe dev servers that HookCode can start for TaskGroup previews.

### preview.instances

Each instance declares:

- `name`: unique identifier (used in preview routing)
- `command`: dev server command (runs with `PORT` injected)
- `workdir`: relative path inside the repo
- `readyPattern`: optional regex to detect readiness from logs
<!-- Remove fixed port configuration in favor of PORT placeholders. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- `port`: **not supported** — previews always use system-assigned ports exposed via `PORT`
<!-- Document preview env placeholder handling for port values. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- `env`: optional env overrides; any port values must use `{{PORT}}` (for example `http://127.0.0.1:{{PORT}}`)

### Port injection

HookCode sets `PORT` (and `HOST=127.0.0.1`) when launching previews. If your command needs the port inline, you can reference it via `$PORT` or `{{PORT}}`:

```yaml
preview:
  instances:
    - name: app
      command: "vite --port $PORT"
      workdir: "frontend"
```

Env values that include a port must also use `{{PORT}}`, for example:

```yaml
preview:
  instances:
    - name: app
      command: "pnpm dev -- --port {{PORT}}"
      workdir: "frontend"
      env:
        PUBLIC_ORIGIN: "http://127.0.0.1:{{PORT}}"
```

### Notes

<!-- Document preview access modes plus HMR/log/share notes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview instances are started on-demand from the TaskGroup chat UI.
- Dependency installs reuse the `dependency` section before preview startup.
- Local previews open directly on the assigned port, while production deployments can use subdomain routing.
- WebSocket HMR is supported in both direct-port and subdomain preview modes.
- Preview logs can be viewed in the TaskGroup preview panel for startup diagnostics.
- Shared preview links include a token query string; keep them private.
<!-- Add Phase 3 preview lifecycle notes (idle timeout + hot reload). docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->
- Preview sessions auto-stop after 30 minutes of inactivity (preview traffic or log streams count as activity).
- Updating `.hookcode.yml` automatically restarts running previews (debounced).
- Failed or timed-out previews surface diagnostic summaries in the preview panel.

### dependency.failureMode

- `soft` (default): missing runtimes or install failures **warn and continue**
- `hard`: missing runtimes or install failures **fail the task**

### dependency.runtimes

Each entry declares:

- `language`: required, one of `node`, `python`, `java`, `ruby`, `go`
- `version`: optional version string (e.g., `3.11`, `18.19.0`)
- `install`: optional install command executed inside the task workspace
- `workdir`: optional relative path for multi-subproject installs (e.g., `backend`, `frontend`)

{/* Explain multi-subproject installs via workdir. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
<!-- Clarify repo-relative paths inside the task-group workspace. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
Install commands run from the repository root inside the task-group workspace, so `workdir` is relative to `<repo-name>/`.

### Multi-subproject installs

If your repository has multiple projects (e.g., `backend` + `frontend`), declare multiple runtime entries and set `workdir` for each:

```yaml
version: 1
dependency:
  failureMode: soft
  runtimes:
    - language: node
      workdir: "backend"
      install: "pnpm install --frozen-lockfile"
    - language: node
      workdir: "frontend"
      install: "pnpm install --frozen-lockfile"
```

## Install command safety rules

Install commands are **whitelisted** for safety. If a command does not match the allowlist, it is blocked unless a robot override is enabled.

### Allowed command patterns

**Node**
- `npm ci [--flags]`
- `npm install [--flags]`
- `yarn install [--flags]`
- `pnpm install [--flags]`

**Python**
- `pip install -r requirements.txt [--flags]`
- `pip install -e . [--flags]`
- `poetry install [--flags]`

**Java**
- `mvn dependency:resolve [flags]`
- `gradle dependencies [--flags]`

**Ruby**
- `bundle install [--flags]`
- `gem install bundler`

<!-- Document Go install allowlist entries. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 -->
**Go**
- `go mod download [--flags]`
- `go mod tidy [--flags]`

### Blocked characters

Commands that contain shell control characters are always rejected:

```
; & | ` $ ( ) { }
```

### Robot overrides

If your robot configuration enables `allowCustomInstall: true`, HookCode can accept non-whitelisted install commands. Even with this override, commands containing blocked characters are still rejected.

## Runtime availability checks

On startup, HookCode detects installed runtimes and exposes them via:

```
GET /api/system/runtimes
```

During task execution, HookCode validates the requested runtimes:

- **All runtimes available**: install commands run in order.
- **Missing runtime + soft**: skip that runtime and log a warning.
- **Missing runtime + hard**: fail the task with a runtime-missing error.

## Execution order

1. Checkout repository
2. Read `.hookcode.yml`
3. Validate runtime availability
4. Run install commands
5. Run AI analysis

## Limits and validation

- Maximum runtimes per file: **5**
- Maximum preview instances per file: **5**
- Install command length: **500** characters
- `version` must be numeric dotted format (e.g., `3`, `3.11`, `18.19.0`)
<!-- Document workdir path constraints. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 -->
- `workdir` must be a relative path inside the repository

## Examples

### Node-only (default behavior)

```yaml
version: 1
dependency:
  runtimes:
    - language: node
      install: "pnpm install --frozen-lockfile"
```

### Python project with strict failure

```yaml
version: 1
dependency:
  failureMode: hard
  runtimes:
    - language: python
      install: "pip install -r requirements.txt"
```

### Multi-language (Node + Java)

```yaml
version: 1
dependency:
  failureMode: soft
  runtimes:
    - language: node
      install: "pnpm install --frozen-lockfile"
    - language: java
      install: "mvn dependency:resolve"
```

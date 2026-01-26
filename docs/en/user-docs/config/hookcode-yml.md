---
title: .hookcode.yml Dependency Configuration
---

<!-- Document repository-level dependency requirements and install rules. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 -->

Use `.hookcode.yml` at the repository root to declare **language runtimes** and **dependency install commands** that HookCode should run after checkout and before AI analysis.

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
```

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

---
title: TaskGroup Preview
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Add user-facing guidance for TaskGroup dev previews. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}

TaskGroup Preview lets you run frontend or backend dev services during a task so you can validate changes immediately.

## Prerequisites

1. Add `preview.instances` to `.hookcode.yml` (see [configuration](./config/hookcode-yml)).
2. Ensure dependencies can be installed via the `dependency` section if your project needs it.

## Start and stop previews

Open a TaskGroup, then use the **Start preview** toggle in the chat header. The preview panel opens automatically while the preview is starting or running, and closes when you stop the preview.
{/* Explain the merged preview start and panel open behavior in the TaskGroup header. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}

Task group entries in the left sidebar show a small dot when previews are active.
{/* Highlight the sidebar preview-active dot for running task groups. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8 */}

## Preview access modes

### Local development (direct port)

When running HookCode locally, previews open directly on the assigned port (for example: `http://127.0.0.1:12345/`). This avoids `/api/preview/...` path rewriting issues and matches the dev server's native URLs.
{/* Document local direct-port preview access. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}

### Production (subdomain + wildcard DNS)

In production, use wildcard subdomains to map each preview instance to its own host name:

1. Configure backend env:
   - `HOOKCODE_PREVIEW_HOST_MODE=subdomain`
   - `HOOKCODE_PREVIEW_BASE_DOMAIN=preview.example.com`
   - Optional: `HOOKCODE_PREVIEW_PUBLIC_SCHEME=https`
2. Add a wildcard DNS record (for example: `*.preview.example.com`) pointing to the backend/public load balancer.
3. Ensure your reverse proxy (Cloudflare, Nginx, etc.) forwards the wildcard hostnames to the HookCode backend.

Preview links will look like `https://<taskGroupId>--<instance>.preview.example.com/` and include a `token` query parameter for authentication.
{/* Document production subdomain preview routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}

## Multiple preview instances

If `preview.instances` declares more than one entry, each instance appears as a tab in the preview panel. Switch tabs to view different apps (for example, `frontend` and `admin`).

{/* Document per-instance preview display modes backed by .hookcode.yml display config. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 */}
## Display modes (`.hookcode.yml`)

Each preview instance can declare a render mode with `display`:

- `webview` (default): iframe-style browser preview, URL bar/navigation, copy/open-link actions.
- `terminal`: plain terminal log output in the preview panel (recommended for backend services).

Example:

```yaml
preview:
  instances:
    - name: frontend
      command: "pnpm dev --host 127.0.0.1 --port {{PORT:frontend}}"
      workdir: "frontend"
      display: webview
    - name: backend
      command: "pnpm run prisma:generate && pnpm exec nest start"
      workdir: "backend"
      display: terminal
```

## Management views

{/* Document repo/admin preview management surfaces so user docs match the new runtime management features. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 */}
- **Repository detail (Overview tab)**: shows preview config discovery plus currently active preview task groups for that repository, including per-instance status and allocated ports.
- **Admin settings preview panel**: shows all active preview task groups across repositories and the global preview port pool snapshot (`range`, `in use`, `available`, and task-group-to-port allocations).
- Port allocation currently uses the backend pool range (`10000-10999` by default).

## Logs and diagnostics

Use **View logs** to open the live log stream for any instance.

- For `webview` instances, logs are usually opened from the logs modal.
- For `terminal` instances, logs are shown inline by default and auto-follow the latest output.
  - Auto-follow pauses if you scroll up.
  - Auto-follow resumes after you scroll back to the bottom.

When a preview fails or times out, a diagnostics block shows the exit code, signal, and recent log tail to help troubleshooting.

## Shareable preview links

The **Copy link** action is available for `webview` instances and produces a preview URL with a `token` query parameter. Treat it like a password: anyone with the link can view the preview while the token is valid.

## DOM highlight bridge (optional, `webview` only)

To enable DOM highlighting inside the preview iframe, import the bridge script from this repository:

1. Copy `shared/preview-bridge.js` **and** the `shared/preview-bridge/` folder into your project (or serve them directly if you mount the repo). {/* Update preview bridge docs for the split module layout. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203 */}
2. Import it in your app entry (for example `main.tsx`):

```ts
import './preview-bridge';
```

When the preview iframe loads, HookCode sends a handshake ping. If the bridge replies, highlight commands sent via the backend API will be forwarded into the iframe:

`POST /api/task-groups/:id/preview/:instance/highlight`
{/* Document preview highlight bridge integration for cross-origin iframes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as */}

## Idle timeout and hot reload

- Preview sessions stop automatically after **30 minutes of inactivity** (preview traffic or log streams count as activity).
- Hidden previews stop automatically after **30 minutes** (for example, if the tab is hidden or you leave the TaskGroup page), and their ports are reclaimed.
{/* Document the hidden preview auto-stop behavior and port reclaim. docs/en/developer/plans/1vm5eh8mg4zuc2m3wiy8/task_plan.md 1vm5eh8mg4zuc2m3wiy8 */}
- Editing `.hookcode.yml` restarts running previews automatically after a short debounce window.

## Workspace layout

{/* Document the task-group workspace structure for preview troubleshooting. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 */}
{/* Route preview workspace docs through HOOKCODE_WORK_DIR so operator storage guidance matches the new runtime layout. docs/en/developer/plans/worker-executor-refactor-20260307/task_plan.md worker-executor-refactor-20260307 */}
Task runs create a workspace under `HOOKCODE_WORK_DIR/task-groups` (default: `~/.hookcode/task-groups`). The default layout is:

- `<work-dir>/task-groups/<taskGroupId>/`
  {/* Mention that bundled skills include per-skill .env copies for API access. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 */}
  - `.codex/skills/` (bundled skills with per-skill .env copies)
  {/* Document Claude/Gemini template folders in the task-group workspace. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205 */}
  - `.claude/skills/` (bundled Claude Code skills)
  - `.gemini/skills/` (bundled Gemini CLI skills)
  - `.env` (task-group API base URL + PAT + task group id)
  - `<repo-name>/` (cloned repository)
  - `codex-output.txt` / `claude-output.txt` / `gemini-output.txt`
  {/* Note codex-schema.json now drives structured output + suggestions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 */}
  - `codex-schema.json` (Codex TurnOptions output schema for structured output + next-action suggestions)
  {/* Note provider-specific instruction files alongside AGENTS.md. docs/en/developer/plans/gemini-claude-agents-20260205/task_plan.md gemini-claude-agents-20260205 */}
  - `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` (task-group rules + embedded .env config)

Model commands run from the task-group root, so repo-relative paths live under `<repo-name>/`.

## Status glossary

- **Starting**: process launched, waiting for readiness.
- **Running**: dev server is ready.
- **Failed**: process exited or crashed.
- **Timeout**: readiness not detected within 5 minutes.
- **Stopped**: preview not running.
- **Unavailable**: no preview config detected.

## Troubleshooting

- **Preview unavailable**: `.hookcode.yml` is missing the `preview` section.
- **Preview config invalid**: schema validation failed (check `name`, `command`, `workdir`).
- **Expected terminal output but got iframe**: set `preview.instances[].display: terminal` for that instance.
- **Workspace missing**: run a task at least once to clone the repo.
- **Dependency install failed**: verify the `dependency` commands in `.hookcode.yml`.

---
title: TaskGroup Preview
---

<!-- Add user-facing guidance for TaskGroup dev previews. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

TaskGroup Preview lets you run your frontend dev server during a task so you can see UI changes immediately.

## Prerequisites

1. Add `preview.instances` to `.hookcode.yml` (see [configuration](./config/hookcode-yml)).
2. Ensure dependencies can be installed via the `dependency` section if your project needs it.

## Start and stop previews

Open a TaskGroup, then use the **Start preview** toggle in the chat header. The preview panel opens automatically while the preview is starting or running, and closes when you stop the preview.
<!-- Explain the merged preview start and panel open behavior in the TaskGroup header. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

## Preview access modes

### Local development (direct port)

When running HookCode locally, previews open directly on the assigned port (for example: `http://127.0.0.1:12345/`). This avoids `/api/preview/...` path rewriting issues and matches the dev server's native URLs.
<!-- Document local direct-port preview access. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

### Production (subdomain + wildcard DNS)

In production, use wildcard subdomains to map each preview instance to its own host name:

1. Configure backend env:
   - `HOOKCODE_PREVIEW_HOST_MODE=subdomain`
   - `HOOKCODE_PREVIEW_BASE_DOMAIN=preview.example.com`
   - Optional: `HOOKCODE_PREVIEW_PUBLIC_SCHEME=https`
2. Add a wildcard DNS record (for example: `*.preview.example.com`) pointing to the backend/public load balancer.
3. Ensure your reverse proxy (Cloudflare, Nginx, etc.) forwards the wildcard hostnames to the HookCode backend.

Preview links will look like `https://<taskGroupId>--<instance>.preview.example.com/` and include a `token` query parameter for authentication.
<!-- Document production subdomain preview routing. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

## Multiple preview instances

If `preview.instances` declares more than one entry, each instance appears as a tab in the preview panel. Switch tabs to view different apps (for example, `frontend` and `admin`).

## Logs and diagnostics

Use **View logs** to open the live log stream. When a preview fails or times out, a diagnostics block shows the exit code, signal, and recent log tail to help troubleshooting.

## Shareable preview links

The **Copy link** action produces a preview URL with a `token` query parameter. Treat it like a password: anyone with the link can view the preview while the token is valid.

## DOM highlight bridge (optional)

To enable DOM highlighting inside the preview iframe, import the bridge script from this repository:

1. Copy `shared/preview-bridge.js` **and** the `shared/preview-bridge/` folder into your project (or serve them directly if you mount the repo). <!-- Update preview bridge docs for the split module layout. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203 -->
2. Import it in your app entry (for example `main.tsx`):

```ts
import './preview-bridge';
```

When the preview iframe loads, HookCode sends a handshake ping. If the bridge replies, highlight commands sent via the backend API will be forwarded into the iframe:

`POST /api/task-groups/:id/preview/:instance/highlight`
<!-- Document preview highlight bridge integration for cross-origin iframes. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

## Idle timeout and hot reload

- Preview sessions stop automatically after **30 minutes of inactivity** (preview traffic or log streams count as activity).
- Editing `.hookcode.yml` restarts running previews automatically after a short debounce window.

## Workspace layout

<!-- Document the task-group workspace structure for preview troubleshooting. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
Task runs create a workspace under the build root (configurable via `HOOKCODE_BUILD_ROOT`). The default layout is:

- `<build-root>/task-groups/<taskGroupId>/`
  <!-- Mention that bundled skills include per-skill .env copies for API access. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
  - `.codex/skills/` (bundled skills with per-skill .env copies)
  - `.env` (task-group API base URL + PAT + task group id)
  - `<repo-name>/` (cloned repository)
  - `codex-output.txt` / `claude-output.txt` / `gemini-output.txt`
  <!-- Note codex-schema.json now drives structured output + suggestions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
  - `codex-schema.json` (Codex TurnOptions output schema for structured output + next-action suggestions)
  - `AGENTS.md` (task-group rules + embedded .env config)

Model commands run from the task-group root, so repo-relative paths live under `<repo-name>/`.

## Status glossary

- **Starting**: process launched, waiting for readiness.
- **Running**: dev server is ready.
- **Failed**: process exited or crashed.
- **Timeout**: readiness not detected in time.
- **Stopped**: preview not running.
- **Unavailable**: no preview config detected.

## Troubleshooting

- **Preview unavailable**: `.hookcode.yml` is missing the `preview` section.
- **Preview config invalid**: schema validation failed (check `name`, `command`, `workdir`).
- **Workspace missing**: run a task at least once to clone the repo.
- **Dependency install failed**: verify the `dependency` commands in `.hookcode.yml`.

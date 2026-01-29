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

## Multiple preview instances

If `preview.instances` declares more than one entry, each instance appears as a tab in the preview panel. Switch tabs to view different apps (for example, `frontend` and `admin`).

## Logs and diagnostics

Use **View logs** to open the live log stream. When a preview fails or times out, a diagnostics block shows the exit code, signal, and recent log tail to help troubleshooting.

## Shareable preview links

The **Copy link** action produces a preview URL with a `token` query parameter. Treat it like a password: anyone with the link can view the preview while the token is valid.

## Idle timeout and hot reload

- Preview sessions stop automatically after **30 minutes of inactivity** (preview traffic or log streams count as activity).
- Editing `.hookcode.yml` restarts running previews automatically after a short debounce window.

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

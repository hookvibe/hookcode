---
title: Features
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



This page summarizes key HookCode features from a user perspective.

## Repository integrations

- GitHub / GitLab Webhook receiver under `/api/webhook/*`
- Optional provider API base URL for self-hosted setups
- Webhook delivery inspection in the console

## Robots (execution profiles)

- Multiple robots per repository
- Per-robot prompt templates
- Multiple credential scopes:
  - robot-level secrets
  - user account-level profiles
  - repo-scoped profiles
- Model providers:
  - Codex
  - Claude Code
  - Gemini CLI

## Automation (triggers)

- Event-based triggers:
  - Issue / Commit / Merge Request
- Rule matching + multiple robot actions
- Prompt patch/override per action

## Tasks & monitoring

- Task list with filtering (repo/robot/status/event type)
- Task detail view with outputs and retry controls
- Optional task logs:
  - fetch logs via API
  - stream logs via SSE

## Chat (manual trigger)

- Run tasks manually from the console without Webhooks
- Chat-style timeline view for a task group
{/* Document preview display-mode support under user-facing chat capabilities. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 */}
- TaskGroup preview tabs support both `webview` (iframe UI) and `terminal` (plain log stream) instance modes
{/* Document preview management surfaces so feature docs include repo/admin runtime visibility and port allocation monitoring. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 */}
- Repository detail shows active preview task groups for that repository (status + allocated ports)
- Admin settings include a preview management panel with global active task groups and port allocation snapshots

{/* Document PAT creation and usage steps for API access. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design */}
## Open API access tokens

- Issue personal access tokens (PATs) from the top-right panel
- Choose group-based read/write scopes (account, repos, tasks, events, system)
- Tokens are shown once and cannot be recovered; store them securely
- Webhook endpoints are excluded from PAT scopes

### How to use

- Open the top-right panel → Credentials → Open API access tokens → Create token
- Set a name, choose expiry (1 day to never), and pick group scopes with read/write level
- Copy the token immediately (it is only revealed once)
- Call the API with an Authorization header using the token
- Use the API base URL from your credential profile (or your HookCode server URL)

```bash
curl -H "Authorization: Bearer <PAT>" https://<api-base-url>/api/...
```

## Archive mode (read-only)

- Archive repositories/tasks to keep history while preventing new automation and edits

---
title: Repository Configuration
---



A Repository in HookCode represents a GitHub/GitLab repository that can send Webhooks to HookCode and receive automation actions (comments, patches, PR/MR operations) through Robots.

## Create a repository

In the console **Repos** page, create a repository by providing:

- **Provider**: `GitHub` or `GitLab`.
- **Repository URL**: used to derive:
  - `name` (display name in HookCode)
  - `externalId` (provider-side identity, e.g. `owner/repo` or `group/project`)
  - `apiBaseUrl` (optional, only for self-hosted providers)

## Webhook setup

After the repository is created, HookCode provides:

- **Webhook URL path** (relative): `/api/webhook/<provider>/<repoId>`
- **Webhook secret**: used to verify webhook signatures

Use the full webhook URL in your provider:

- `https://<your-hookcode-host>/api/webhook/<provider>/<repoId>`

### Webhook verification

HookCode marks a repository as “verified” after it receives at least one authenticated webhook delivery.

Practical implications:

- Verification helps distinguish “not configured” vs “configured but no events yet”.
- The console can use webhook deliveries to troubleshoot why automation did not run.

## Branch configuration

You can optionally configure branches for a repository:

- **name**: branch name (e.g. `main`, `dev`, `release/v1`)
- **note**: human description (e.g. “production branch”)
- **isDefault**: whether this is the repository default branch in HookCode

Branches are used for:

- UI drop-downs (robot default branch, trigger branch conditions)
- Prompt template variables (branch names/notes)

> Note: Issue webhooks do not include branch context, so Issue automation rules should not rely on branch filters.

## Enable/Disable vs Archive

- **Disabled** repositories will not run automation/tasks.
- **Archived** repositories are treated as **read-only** in the console:
  - Mutating operations (robot changes, automation edits, retries) are blocked.
  - Archived items are hidden from default lists unless you filter for archived.

## Credentials scope (repo-level)

Repositories can store **repo-scoped credential profiles**:

- Repo provider tokens (GitHub/GitLab)
- Model provider API keys (Codex / Claude Code / Gemini CLI)

Robots can choose credentials from:

- Robot-level secrets
- User account-level profiles
- Repo-scoped profiles

See [Robot configuration](./robots) for details.


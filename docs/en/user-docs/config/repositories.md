---
title: Repository Configuration
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



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

{/* Document repo member management roles. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
## Member management

Repository member management is available in the repo detail page:

- **Owner**: full control, including deleting the repository and managing members.
- **Maintainer**: can manage repo settings, robots, automation, and members.
- **Member**: read-only access to repo details and task history.

Use the **Members** section to invite users by email, change roles, and revoke pending invites.

## Credentials scope (repo-level)

Repositories can store **repo-scoped credential profiles**:

- Repo provider tokens (GitHub/GitLab)
- Model provider API keys (Codex / Claude Code / Gemini CLI)

Robots can choose credentials from:

- Robot-level secrets
- User account-level profiles
- Repo-scoped profiles

See [Robot configuration](./robots) for details.

{/* Document repo preview env injection for preview-only dev servers. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 */}
## Preview environment variables

Use the **Env** tab in the repository detail page to inject environment variables into **preview dev servers only**.

Key rules:

{/* Clarify repo preview env placeholder semantics. docs/en/developer/plans/preview-env-config-20260302/task_plan.md preview-env-config-20260302 */}
- Variables apply only when HookCode starts preview instances (they do not affect tasks or analysis runs).
- Fixed local preview ports are blocked; use `{{PORT:frontend}}` / `{{PORT:backend}}` placeholders instead.
- `{{PORT}}` resolves to the current preview instance port; use `{{PORT:<name>}}` to reference a specific instance.
- Reserved keys such as `PORT`, `HOST`, and any `HOOKCODE_*` variables are not allowed.
- All values are treated as secrets: the UI shows “configured” but never reveals stored values.

For sensitive configuration (for example `DATABASE_URL`), prefer this Env tab instead of committing secrets in `.hookcode.yml`.

{/* Document repo-level preview runtime visibility so repository docs cover active task-group management UI. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 */}
## Preview runtime visibility

In the repository detail **Overview** tab, the Preview section now includes:

- Detected preview instances from `.hookcode.yml`
- Active preview task groups for this repository
- Per-instance runtime status and assigned ports for each active task group

Use this section to quickly find which task groups currently hold preview resources for the repository.

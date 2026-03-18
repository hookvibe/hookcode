---
title: Robot Configuration
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



A Robot defines **how HookCode executes tasks** for a repository:

- Which model provider to use (Codex / Claude Code / Gemini CLI)
- Which credentials to use (repo provider token + model API key)
- The default prompt template and language preference

## Robot lifecycle

Typical setup flow:

1. Create a robot under a repository.
2. Configure credentials and the prompt template.
3. Test the robot to validate credentials and activate it.
4. Use the robot in:
   - Automation triggers (Issue/Commit/MR)
   - Manual Chat runs

## Repo provider credentials (GitHub/GitLab)

Robots need repo provider credentials to:

- Read repository data (diffs, commits, issues, MRs/PRs)
- Post comments / create follow-up actions

HookCode supports multiple credential sources:

- **robot**: a per-robot token stored for that robot (secret is never returned by the API).
- **user**: an account-level credential profile owned by the current user.
- **repo**: a repo-scoped credential profile stored on the repository.

Choose the minimal permissions required for your use case:

- “Read-only review” robots only need read + comment permissions.
- “Workspace-write” / PR/MR automation robots need write permissions (push/merge as applicable).

## Model provider configuration (Codex / Claude Code / Gemini CLI)

{/* Normalize this robot doc comment to Mintlify-safe MDX syntax while preserving provider credential guidance. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313 */}
HookCode checks local machine provider auth first during execution. If no local CLI login or environment key is available, the robot falls back to its configured stored credential source:

- **robot**: store the API key directly on the robot configuration.
- **repo**: select a repo-scoped model credential profile.
- **user**: select an account-level model credential profile.

If a robot is configured for **repo** but the repo-scoped profile is unavailable, HookCode falls back to the user-scoped profile.

Depending on the provider, you may also configure:

- API base URL (for self-hosted / proxy setups)
- Model name (selected from the provider’s model list)

## Prompt template

Robots have a **default prompt template** that supports `{{var}}`-style template variables.

Automation rules can further adjust prompts via:

- **promptPatch**: appended after the robot default template
- **promptOverride**: full override (ignores the robot default template and patch)

{/* Document the robot playground entry points and dry-run safety guarantees for repo editors. docs/en/developer/plans/robot-dryrun-playground-20260313/task_plan.md robot-dryrun-playground-20260313 */}
## Prompt playground and dry run

The repo robot editor now exposes two validation actions:

- **Preview Prompt**: render the final prompt for the current unsaved robot draft without running a model.
- **Dry Run**: run the same draft through the selected provider in an isolated temporary workspace.

The playground supports these simulation inputs:

- `manual_chat`
- `issue`
- `merge_request`
- `push`
- `custom` payload

Every run shows:

- the final rendered prompt
- resolved provider/model/sandbox information
- credential-resolution summary and routing attempts
- model output (for `execute_no_side_effect`)
- warnings and side-effect protections

Dry runs are intentionally constrained:

- they never mutate the real repository checkout
- they never post provider comments or status updates
- they never create PRs/MRs
- they never persist a real task execution record

{/* Document robot dependency overrides for install behavior. docs/en/developer/plans/depmanimpl20260124/task_plan.md depmanimpl20260124 */}
## Dependency install overrides

Robots can override repository `.hookcode.yml` dependency settings on a per-robot basis:

- **enabled**: disable dependency installs even if `.hookcode.yml` defines them.
- **failureMode**: override `soft` vs `hard` handling for missing runtimes / install failures.
- **allowCustomInstall**: allow install commands outside the allowlist (blocked characters are still rejected).

If overrides are disabled, the robot follows the repository `.hookcode.yml` configuration.

## Language and default branch

- **language**: recommended to use BCP 47 tags (e.g. `en-US`, `zh-CN`). Exposed to templates as `{{robot.language}}`.
- **defaultBranch**: fallback checkout branch for tasks without branch context (issues/comments).

## Test and activation

Robot “Test” validates:

- Repo provider token usability
- Model provider credential availability (where applicable)

After a successful test, HookCode stores derived metadata (provider username/id) for better UX and git identity defaults.

## Default robot

Mark one robot as **default** for a repository to simplify:

- Manual Chat selection
- Rule creation (common default action choice)

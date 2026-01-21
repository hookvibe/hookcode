---
title: Robot Configuration
---



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

Each robot selects a model provider and a credential source:

- **robot**: store the API key directly on the robot configuration.
- **user**: select an account-level model credential profile.
- **repo**: select a repo-scoped model credential profile.

Depending on the provider, you may also configure:

- API base URL (for self-hosted / proxy setups)
- Model name (selected from the provider’s model list)

## Prompt template

Robots have a **default prompt template** that supports `{{var}}`-style template variables.

Automation rules can further adjust prompts via:

- **promptPatch**: appended after the robot default template
- **promptOverride**: full override (ignores the robot default template and patch)

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


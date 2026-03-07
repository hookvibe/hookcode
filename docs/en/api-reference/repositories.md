---
title: Repositories
---
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}

{/* Replace legacy OpenAPI MDX components with Mintlify endpoint mapping. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}



## Introduction

Repository APIs manage:

- Repository records (provider, identity, branches, enabled/archive state)
- Repo-scoped credentials (repo provider tokens + model provider API keys)
- Robots under a repository (create/edit/test/delete)
- Automation configuration (rules/actions)
- Repo member management + invite acceptance
- Provider metadata/activity and webhook delivery troubleshooting

<Callout type="info" title="OpenAPI-backed details">
  Full request/response schemas are available under the **Endpoints** group in the sidebar (powered by `/api/openapi.json`).
</Callout>

## Endpoint Map

- `GET /api/repos` — List repositories visible to the user.
- `POST /api/repos` — Create a new repository record.
- `GET /api/repos/:id` — Fetch repository details (including robots and automation).
- `PATCH /api/repos/:id` — Update repository settings.
- `DELETE /api/repos/:id` — Delete a repository.
- `POST /api/repos/:id/archive` — Archive a repository (read-only).
- `POST /api/repos/:id/unarchive` — Unarchive a repository.
- `GET /api/repos/:id/provider-meta` — Fetch provider metadata (branches, info).
- `GET /api/repos/:id/provider-activity` — Fetch provider activity feed.
- `GET /api/repos/:id/webhook-deliveries` — List webhook delivery attempts.
- `GET /api/repos/:id/webhook-deliveries/:deliveryId` — Inspect a webhook delivery.
- `POST /api/repos/:id/model-credentials/models` — List available models for a provider.
- `GET /api/repos/:id/robots` — List robots under a repository.
- `POST /api/repos/:id/robots` — Create a robot.
- `PATCH /api/repos/:id/robots/:robotId` — Update a robot (including optional `defaultWorkerId`).
- `POST /api/repos/:id/robots/:robotId/test` — Test a robot's credentials.
- `DELETE /api/repos/:id/robots/:robotId` — Delete a robot.
{/* Document repo member + invite operations. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- `GET /api/repos/:id/members` — List repository members.
- `PATCH /api/repos/:id/members/:userId` — Update a member role.
- `DELETE /api/repos/:id/members/:userId` — Remove a member.
- `GET /api/repos/:id/invites` — List pending invites.
- `POST /api/repos/:id/invites` — Invite a member.
- `DELETE /api/repos/:id/invites/:inviteId` — Revoke an invite.
- `POST /api/repos/invites/accept` — Accept an invite.
- `GET /api/repos/:id/automation` — Fetch automation configuration.
- `PUT /api/repos/:id/automation` — Update automation configuration.

## Notes

- Archived repositories are treated as **read-only** and the backend blocks mutations (robots/automation/retry/etc.).
- Provider meta/activity endpoints may require credentials for private repos; anonymous mode cannot distinguish “private” vs “not found” reliably.
- Automation config is versioned JSON; the backend validates rules (rule name required; at least 1 robot action required).
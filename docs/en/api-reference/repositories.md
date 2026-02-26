---
title: Repositories
---

import { OpenApiOperation, OpenApiProvider, OpenApiSettings } from '@site/src/components/openapi';

<!-- Render per-repository operations as OpenAPI cards. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126 -->



## Introduction

Repository APIs manage:

- Repository records (provider, identity, branches, enabled/archive state)
- Repo-scoped credentials (repo provider tokens + model provider API keys)
- Robots under a repository (create/edit/test/delete)
- Automation configuration (rules/actions)
- Repo member management + invite acceptance
- Provider metadata/activity and webhook delivery troubleshooting

<OpenApiProvider>
<OpenApiSettings />

## APIs

### GET `/api/repos`
<OpenApiOperation operationId="repos_list" />

### POST `/api/repos`
<OpenApiOperation operationId="repos_create" />

### GET `/api/repos/:id`
<OpenApiOperation operationId="repos_get" />

### PATCH `/api/repos/:id`
<OpenApiOperation operationId="repos_patch" />

### DELETE `/api/repos/:id`
<OpenApiOperation operationId="repos_delete" />

### POST `/api/repos/:id/archive`
<OpenApiOperation operationId="repos_archive" />

### POST `/api/repos/:id/unarchive`
<OpenApiOperation operationId="repos_unarchive" />

### GET `/api/repos/:id/provider-meta`
<OpenApiOperation operationId="repos_get_provider_meta" />

### GET `/api/repos/:id/provider-activity`
<OpenApiOperation operationId="repos_get_provider_activity" />

### GET `/api/repos/:id/webhook-deliveries`
<OpenApiOperation operationId="repos_list_webhook_deliveries" />

### GET `/api/repos/:id/webhook-deliveries/:deliveryId`
<OpenApiOperation operationId="repos_get_webhook_delivery" />

### POST `/api/repos/:id/model-credentials/models`
<OpenApiOperation operationId="repos_list_model_provider_models" />

### GET `/api/repos/:id/robots`
<OpenApiOperation operationId="repos_list_robots" />

### POST `/api/repos/:id/robots`
<OpenApiOperation operationId="repos_create_robot" />

### PATCH `/api/repos/:id/robots/:robotId`
<OpenApiOperation operationId="repos_patch_robot" />

### POST `/api/repos/:id/robots/:robotId/test`
<OpenApiOperation operationId="repos_test_robot" />

### DELETE `/api/repos/:id/robots/:robotId`
<OpenApiOperation operationId="repos_delete_robot" />

<!-- Document repo member + invite operations. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 -->
### GET `/api/repos/:id/members`
<OpenApiOperation operationId="repos_list_members" />

### PATCH `/api/repos/:id/members/:userId`
<OpenApiOperation operationId="repos_update_member_role" />

### DELETE `/api/repos/:id/members/:userId`
<OpenApiOperation operationId="repos_remove_member" />

### GET `/api/repos/:id/invites`
<OpenApiOperation operationId="repos_list_invites" />

### POST `/api/repos/:id/invites`
<OpenApiOperation operationId="repos_create_invite" />

### DELETE `/api/repos/:id/invites/:inviteId`
<OpenApiOperation operationId="repos_revoke_invite" />

### POST `/api/repos/invites/accept`
<OpenApiOperation operationId="repos_accept_invite" />

### GET `/api/repos/:id/automation`
<OpenApiOperation operationId="repos_get_automation" />

### PUT `/api/repos/:id/automation`
<OpenApiOperation operationId="repos_put_automation" />
</OpenApiProvider>

## Notes

- Archived repositories are treated as **read-only** and the backend blocks mutations (robots/automation/retry/etc.).
- Provider meta/activity endpoints may require credentials for private repos; anonymous mode cannot distinguish “private” vs “not found” reliably.
- Automation config is versioned JSON; the backend validates rules (rule name required; at least 1 robot action required).

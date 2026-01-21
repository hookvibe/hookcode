---
title: Repositories
---



## Introduction

Repository APIs manage:

- Repository records (provider, identity, branches, enabled/archive state)
- Repo-scoped credentials (repo provider tokens + model provider API keys)
- Robots under a repository (create/edit/test/delete)
- Automation configuration (rules/actions)
- Provider metadata/activity and webhook delivery troubleshooting

## APIs

| Method | Path | Auth | Operation ID | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/repos` | Bearer | `repos_list` | List repositories (supports `?archived=` filtering). |
| POST | `/api/repos` | Bearer | `repos_create` | Create repository and return webhook path/secret. |
| GET | `/api/repos/:id` | Bearer | `repos_get` | Get repository detail (robots, automation, webhook info, repo-scoped credentials). |
| PATCH | `/api/repos/:id` | Bearer | `repos_patch` | Update repository settings (name, identity, branches, enabled, secrets, credentials). |
| POST | `/api/repos/:id/archive` | Bearer | `repos_archive` | Archive a repository (cascades to tasks/task groups). |
| POST | `/api/repos/:id/unarchive` | Bearer | `repos_unarchive` | Unarchive a repository (cascades to tasks/task groups). |
| GET | `/api/repos/:id/provider-meta` | Bearer | `repos_get_provider_meta` | Fetch provider visibility metadata using selected credentials or anonymous mode. |
| GET | `/api/repos/:id/provider-activity` | Bearer | `repos_get_provider_activity` | Fetch provider activity (commits/merges/issues) using selected credentials or anonymous mode. |
| GET | `/api/repos/:id/webhook-deliveries` | Bearer | `repos_list_webhook_deliveries` | List webhook delivery records for a repository. |
| GET | `/api/repos/:id/webhook-deliveries/:deliveryId` | Bearer | `repos_get_webhook_delivery` | Get a webhook delivery record by id. |
| POST | `/api/repos/:id/model-credentials/models` | Bearer | `repos_list_model_provider_models` | List models for a model provider using repo-scoped profiles or inline API key (never returned). |
| GET | `/api/repos/:id/robots` | Bearer | `repos_list_robots` | List robots under a repository. |
| POST | `/api/repos/:id/robots` | Bearer | `repos_create_robot` | Create a robot under a repository. |
| PATCH | `/api/repos/:id/robots/:robotId` | Bearer | `repos_patch_robot` | Update a robot under a repository. |
| POST | `/api/repos/:id/robots/:robotId/test` | Bearer | `repos_test_robot` | Test robot credentials and update activation metadata. |
| DELETE | `/api/repos/:id/robots/:robotId` | Bearer | `repos_delete_robot` | Delete a robot under a repository. |
| GET | `/api/repos/:id/automation` | Bearer | `repos_get_automation` | Get repository automation config. |
| PUT | `/api/repos/:id/automation` | Bearer | `repos_put_automation` | Replace repository automation config (validated by backend). |

## Notes

- Archived repositories are treated as **read-only** and the backend blocks mutations (robots/automation/retry/etc.).
- Provider meta/activity endpoints may require credentials for private repos; anonymous mode cannot distinguish “private” vs “not found” reliably.
- Automation config is versioned JSON; the backend validates rules (rule name required; at least 1 robot action required).

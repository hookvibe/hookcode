---
title: Auth & Users
---



## Introduction

These endpoints cover:

- Console authentication (`/auth/*`)
- Current user profile updates (`/users/me`)
- Credential profile management for model/repo providers (redacted in responses)

## APIs

| Method | Path | Auth | Operation ID | Description |
| --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | Public | `auth_login` | Log in with username/password and return a bearer token. |
| GET | `/api/auth/me` | Bearer (optional when auth disabled) | `auth_me` | Get current user, feature flags, and token timestamps. |
| PATCH | `/api/users/me` | Bearer | `users_patch_me` | Update current user profile fields (e.g. display name). |
| PATCH | `/api/users/me/password` | Bearer | `users_change_password` | Change current user password. |
| GET | `/api/users/me/model-credentials` | Bearer | `users_get_model_credentials` | Get current user credentials in a safe-to-display (redacted) form. |
| PATCH | `/api/users/me/model-credentials` | Bearer | `users_patch_model_credentials` | Update current user credential profiles and provider settings. |
| POST | `/api/users/me/model-credentials/models` | Bearer | `users_list_model_provider_models` | List models for a provider using either a stored profile or an inline API key (never returned). |

## Notes

- When auth is disabled (`AUTH_ENABLED=false`), `/api/auth/me` returns `authEnabled=false` and `user=null`.
- Credentials are always redacted in API responses:
  - Tokens / API keys are never returned once stored.
  - “Set/keep” UI modes should be used to avoid accidentally clearing secrets.
- Model listing endpoints return explicit error codes for common mistakes (example: invalid/unauthorized API key).


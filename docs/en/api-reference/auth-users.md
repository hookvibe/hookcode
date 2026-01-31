---
title: Auth & Users
---

import { OpenApiOperation, OpenApiProvider, OpenApiSettings } from '@site/src/components/openapi';

<!-- Render per-operation OpenAPI cards instead of a flat table. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126 -->



## Introduction

These endpoints cover:

- Console authentication (`/auth/*`)
- Current user profile updates (`/users/me`)
- Credential profile management for model/repo providers (redacted in responses)

<OpenApiProvider>
<OpenApiSettings />

## APIs

### POST `/api/auth/login`
<OpenApiOperation operationId="auth_login" />

### GET `/api/auth/me`
<OpenApiOperation operationId="auth_me" />

### PATCH `/api/users/me`
<OpenApiOperation operationId="users_patch_me" />

### PATCH `/api/users/me/password`
<OpenApiOperation operationId="users_change_password" />

### GET `/api/users/me/model-credentials`
<OpenApiOperation operationId="users_get_model_credentials" />

### PATCH `/api/users/me/model-credentials`
<OpenApiOperation operationId="users_patch_model_credentials" />

### POST `/api/users/me/model-credentials/models`
<OpenApiOperation operationId="users_list_model_provider_models" />
</OpenApiProvider>

## Notes

- When auth is disabled (`AUTH_ENABLED=false`), `/api/auth/me` returns `authEnabled=false` and `user=null`.
- Credentials are always redacted in API responses:
  - Tokens / API keys are never returned once stored.
  - “Set/keep” UI modes should be used to avoid accidentally clearing secrets.
- Model listing endpoints return explicit error codes for common mistakes (example: invalid/unauthorized API key).

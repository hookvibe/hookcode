# Findings & Decisions: backend mcp
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. z4xn4m8yue7jxh9jv1p2 */}

## Session Metadata
- **Session Hash:** z4xn4m8yue7jxh9jv1p2
- **Created:** 2026-01-30

## Requirements
- Expose current backend APIs in `/backend` as an MCP server interface.
- Transport: HTTP.
- Auth: token provided via MCP config (client-supplied).
- Scope: tasks, task groups, webhook (and extensible later).
- MCP server should live under `.codex` as a user-side server.
- User does not want to run build/dev commands right now.

## Research Findings
- `/backend` is a NestJS project (Nest CLI, @nestjs/* deps).
- Backend already has Express and Swagger dependencies, so HTTP REST endpoints exist.
- Controllers found: events, users, system, openapi, repositories, health, auth, tools, tasks (task groups/preview/chat/dashboard), webhook.
- There is an OpenAPI endpoint at `/openapi.json` with locale-aware spec via `OpenApiSpecStore`.
- `ToolsController` exposes `GET /tools/meta` and uses bearer auth.
- `TasksController` endpoints include:
  - `GET /tasks` list
  - `GET /tasks/stats`
  - `GET /tasks/volume`
  - `GET /tasks/:id`
  - `GET /tasks/:id/logs`
  - `DELETE /tasks/:id/logs`
  - `GET /tasks/:id/logs/stream` (SSE, allow query token)
  - `POST /tasks/:id/retry`
  - `POST /tasks/:id/execute-now`
  - `POST /tasks/:id/git/push`
  - `DELETE /tasks/:id`
- `TaskGroupsController` endpoints include:
  - `GET /task-groups`
  - `GET /task-groups/:id`
  - `GET /task-groups/:id/tasks`
- `WebhookController` endpoints include:
  - `POST /webhook/gitlab/:repoId`
  - `POST /webhook/github/:repoId`
  - `@Public()` (no auth guard)
- Auth token extraction supports:
  - `Authorization: Bearer <token>`
  - `x-hookcode-token: <token>`
  - optional `?token=` query for endpoints with `@AllowQueryToken()` (SSE logs stream)
- `@modelcontextprotocol/sdk` appears in `pnpm-lock.yaml` as an indirect dependency but is not installed in root or backend `node_modules` right now.
- Added `@modelcontextprotocol/sdk@1.25.2` to `backend` via pnpm (now direct dependency).
- SDK docs/examples are available under `backend/node_modules/@modelcontextprotocol/sdk/dist/cjs/examples/server/` including `simpleStreamableHttp` and `jsonResponseStreamableHttp`.
- Streamable HTTP server example uses `McpServer` + `StreamableHTTPServerTransport` with `/mcp` POST (JSON-RPC) and optional GET (SSE) handlers.
- `enableJsonResponse: true` in `StreamableHTTPServerTransport` supports JSON-only responses (no SSE stream).
- `createMcpExpressApp()` configures Express with JSON parsing and optional host header validation for DNS rebinding protection.
- `StreamableHTTPServerTransport` passes `req.auth` into `authInfo` for tool handlers (via `extra.authInfo`).
- `AuthInfo` shape requires `token`, `clientId`, and `scopes` (with optional `expiresAt`, `resource`, `extra`).
- MCP server will run as a separate backend entrypoint with its own host/port and base URL configuration, plus a minimal client helper under `.codex`.
- Added backend MCP implementation under `backend/src/mcp` with config/auth/proxy/tool registry and unit tests.
<!-- Record MCP config.toml keys from Codex docs for project-scoped setup. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2 -->
- Codex MCP config uses `[mcp_servers.<name>]` with HTTP keys like `url`, `bearer_token_env_var`, `http_headers`, `env_http_headers`, plus toggles `enabled`, `enabled_tools`, `disabled_tools`, `startup_timeout_sec`, and `tool_timeout_sec`; project-scoped `.codex/config.toml` is supported for trusted projects.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Implement MCP as a standalone HTTP server entrypoint under `backend/src/mcp` | Avoids coupling to Nest while satisfying “server in backend” requirement |
| Forward auth token from MCP request headers to backend API | Lets MCP client provide token via config without persisting secrets server-side |
| Use Streamable HTTP transport with optional JSON-only mode | Supports MCP spec and simpler HTTP-only clients |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `/backend/package.json`
- `/backend/src/modules/auth/auth.guard.ts`
- `/backend/src/modules/auth/authToken.ts`
- `/backend/src/modules/tasks/tasks.controller.ts`
- `/backend/src/modules/tasks/task-groups.controller.ts`
- `/backend/src/modules/webhook/webhook.controller.ts`
- `/backend/src/modules/openapi/openapi.controller.ts`
- `/pnpm-lock.yaml`

## Visual/Browser Findings
- None.

---
*Update this file after every 2 view/browser/search operations*

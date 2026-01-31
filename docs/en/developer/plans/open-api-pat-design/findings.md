# Findings & Decisions: open-api-pat-design
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. open-api-pat-design */}

## Session Metadata
- **Session Hash:** open-api-pat-design
- **Created:** 2026-01-30

## Requirements
- Add a “Request PAT” operation inside the top-right panel (Credentials tab).
- PATs must authenticate backend API access.
- Scopes are group-based (no per-endpoint selection) with read/write levels.
- Expiry selection must support 1 day up to never-expire.
- Webhook APIs must not be included in PAT scope options.

## Research Findings
- Top-right panel is implemented as a modal in `frontend/src/components/UserPanelPopover.tsx` with tabs: account, credentials, tools, environment, settings.
- Credentials tab uses the pattern: section title + description + card list + “Add” button + manage modal; secrets are never displayed.
- i18n keys for the panel live under `panel.*` in both `frontend/src/i18n/messages/en-US.ts` and `frontend/src/i18n/messages/zh-CN.ts`.
- Backend auth uses a lightweight HMAC-signed token scheme (not JWT) in `backend/src/auth/authService.ts` for login tokens; no dedicated PAT concept yet.
- Auth guard extracts tokens from `Authorization: Bearer`, `x-hookcode-token`, or `?token=` (if allowed) and verifies via `verifyToken`, then loads the user record.
- API controllers are tagged by module (`Auth`, `Users`, `Repos`, `Tasks`, `Task Groups`, `Dashboard`, `Chat`, `Preview`, `Events`, `System`, `OpenAPI`, `Tools`, `Webhook`, `Health`), which can map to group-based scopes.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Store PATs in a dedicated `user_api_tokens` table with hashed tokens | Avoids storing secrets while enabling lookup and auditing |
| Use scope groups: account, repos, tasks, events, system | Keeps group list short while covering modules | 
| Treat write level as superset of read | Matches common permission semantics |
| Use `hcpat_` prefix for PAT tokens | Allows quick token-type detection in auth guard |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Missing backend/src/middlewares/auth.ts | Located auth modules under backend/src/modules/auth/ |

## Resources
- frontend/src/components/UserPanelPopover.tsx
- frontend/src/i18n/messages/en-US.ts
- frontend/src/i18n/messages/zh-CN.ts
- backend/src/auth/authService.ts
- backend/src/modules/auth/auth.guard.ts
- backend/src/modules/auth/authToken.ts
- backend/src/modules/auth/auth.controller.ts
- backend/src/modules/* (module list)
- docs/en/developer/plans/open-api-pat-design/task_plan.md

## Visual/Browser Findings
- None yet.

---
*Update this file after every 2 view/browser/search operations*
<!-- Track remaining work and completion verification after resume. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design -->
- Resumed session after prior implementation; remaining work is to rerun frontend unit test (userPanelPopover) and update plan/progress completion status. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design
<!-- Sync phase status in plan/progress after implementation completion. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design -->
- Noted task_plan/progress still show Phase 1 in_progress with later phases pending; needs synchronization to completion.
<!-- Log test rerun and completion sync for the session. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design -->
- Frontend PAT panel unit test rerun passed and plan/progress were updated to complete.
<!-- Record discovery of existing features doc section for PATs. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design -->
- Found existing "Open API access tokens" section in docs/en/user-docs/features.md, needs usage details expansion.

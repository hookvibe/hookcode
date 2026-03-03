# Findings & Decisions: Multi-user roles, repo control, registration, invites
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. multiuserauth20260226 */}

## Session Metadata
- **Session Hash:** multiuserauth20260226
- **Created:** 2026-02-26

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Add multi-user role-based access control with global admin plus repo roles: owner/maintainer/member.
- Default repo visibility is private; access controlled by membership or admin.
- Implement full repo control permissions (archive/restore/delete, webhook/token/automation/robot settings).
- Add member management with invite + acceptance flow.
- Complete registration flow with username, password, and email, including email sending.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- Backend auth currently has login only; registration endpoint is missing despite `isAuthRegisterEnabled` flags.
- Integration tests create users directly via `UserService.createUser`, not via a public register API.
- Prisma schema lacks email verification or membership tables; only `User` table exists.
- Frontend auth utilities already track a pending email for verification (`VERIFY_EMAIL_NEXT_KEY`), indicating UI flow placeholders.
- Frontend currently only has `LoginPage` with username/password; no registration or verification pages exist.
- Backend already depends on `nodemailer`, but there is no mailer service yet.
- Backend `.env.example` already defines registration toggles, email verification TTL, and console base URL for verification links.
- App-level unit tests for repo webhook deliveries still call controller methods without the new `req` parameter. {/* Update test calls for new controller req param. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo webhook delivery endpoints now require `ensureRequestUser` and `repoAccessService` checks, so unit tests must supply request user + RepoAccessService mock. {/* Align webhook delivery unit tests with new req and access guard dependencies. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- No existing unit tests in `backend/src/tests` mock `RepoAccessService`, so new mocks must be added for controllers with RBAC guards. {/* Note missing RepoAccessService test mocks to add. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Task logs controller tests still call `logs`/`clearLogs` without the new parameters, so unit tests need to pass `tailRaw` and `id` args. {/* Track task logs unit test signature updates. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- TasksController constructor now requires `RepoAccessService`, and `volumeByDay` includes an `archived` query param. {/* Record tasks controller DI/signature changes for unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- PreviewProxyController constructor now requires `PreviewService`, `TaskService`, and `RepoAccessService` mocks for unit tests. {/* Track preview proxy controller DI updates. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo Swagger DTO file declares `RepoPermissionsSwaggerDto` after it is referenced, causing DI bootstrap errors in tests. {/* Note swagger DTO declaration order issue. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- DashboardController constructor now requires `RepoAccessService` and `sidebar` expects `req` plus `eventType` query param. {/* Capture dashboard controller signature changes for unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Task logs endpoints now require `req` and parse `tail`/`id` params, so unit tests must pass a request with user. {/* Track tasks logs req/user requirements for unit tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- RepositoriesController write endpoints (patch/robots/automation/delete) now take `req` first and enforce repo access, so archived read-only tests must pass request + repo access mocks. {/* Note repo archived read-only test signature changes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Robot write endpoints on RepositoriesController accept `(id, req, body)` for creation and need req.user in tests. {/* Capture robot endpoint param order for test updates. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo robot/automation endpoints now expect `req` as the first parameter for delete and update methods, so archived-read-only tests must pass a request object there too. {/* Track robot/automation delete/update req parameter order for tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Task log handlers call `requireTaskManage`, so unit tests need a `RepoAccessService.requireRepoManage` stub for logs/clearLogs. {/* Record task logs repo manage requirement for tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Tasks controller currently returns `permissions.canManage=true` for all tasks and does not apply repo access filtering.
- Frontend API layer is split under `frontend/src/api/*` with a dedicated `auth.ts` module for auth calls.
- Frontend auth API currently only supports login/me/update; no register or verify endpoints.
- Backend auth controller issues tokens with `roles: []` and exposes only login/me.
- Task-group endpoints lack repo access checks and task-group listing lacks repo filter support (needs allowedRepoIds).
- Dashboard and preview controllers currently bypass repo access checks and always mark tasks as manageable.
{/* Reviewed plan to prioritize remaining frontend UI, routing, and type updates before tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Reviewed plan to prioritize remaining frontend UI, routing, and type updates before tests.
{/* Frontend router only covers home/tasks/repos/archive/login/skills, missing register/verify/invite routes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Frontend router only covers home/tasks/repos/archive/login/skills, missing register/verify/invite routes.
{/* Repo detail page is large and currently lacks RBAC-based UI gating or member/invite panels. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo detail page is large and currently lacks RBAC-based UI gating or member/invite panels.
{/* Frontend repo API types do not yet include RBAC fields (myRole/permissions) or member/invite DTOs. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Frontend repo API types do not yet include RBAC fields (myRole/permissions) or member/invite DTOs.
{/* Frontend repos API module lacks member/invite endpoints and delete/unarchive/delete repo operations. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Frontend repos API module lacks member/invite endpoints and delete/unarchive/delete repo operations.
{/* Locale resources live under frontend/src/i18n (file names need to be confirmed). docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Locale resources live under `frontend/src/i18n` (file names need to be confirmed).
{/* Checked task_plan error section to log recent command failures. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Checked task_plan error section to log recent command failures.
 {/* Locale messages live in frontend/src/i18n/messages/zh-CN.ts and frontend/src/i18n/messages/en-US.ts. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Locale messages live in `frontend/src/i18n/messages/{zh-CN.ts,en-US.ts}`.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
|          |           |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
{/* Capture failing unit tests after RBAC changes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
| Backend unit tests fail due to updated controller signatures and missing DI mocks after RBAC updates. | Pending: update unit tests to match new controller params and dependencies. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- backend/src/modules/auth/auth.controller.ts
- backend/src/auth/authService.ts
- backend/src/tests/integration/authFlow.test.ts
- backend/prisma/schema.prisma
- frontend/src/auth.ts
- frontend/src/pages/LoginPage.tsx
- backend/package.json
- backend/.env.example
- frontend/src/api

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
-
{/* Task types already include permissions.canManage and TasksPage respects it in actions. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Task types already include `permissions.canManage` and `TasksPage` respects it in actions.
{/* AuthMeResponse already exposes register feature flags for login/register UI logic. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- `AuthMeResponse.features` already exposes register flags for login/register UI logic.
{/* AppShell currently only renders LoginPage for unauth users; new register/verify/invite pages must hook into this auth gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- AppShell currently only renders `LoginPage` for unauth users; register/verify/invite pages must integrate with auth gating.
{/* RepoAccessService defines RepoPermissions with canRead/canManage/canDelete/canManageMembers/canManageTasks. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- RepoAccessService defines `RepoPermissions` fields: `canRead`, `canManage`, `canDelete`, `canManageMembers`, `canManageTasks`.
{/* Reviewed task_plan error table to append missing swagger file lookup error. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Reviewed task_plan error table to append missing swagger file lookup error.
{/* Repo Swagger DTOs live in backend/src/modules/repositories/dto/repositories-swagger.dto.ts and define member/invite shapes. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo Swagger DTOs live in `backend/src/modules/repositories/dto/repositories-swagger.dto.ts` and include member/invite shapes.
{/* Repo member/invite endpoints return OkResponse for updates/removals and require repo manage permissions. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo member/invite endpoints return OkResponse for updates/removals and require repo manage permissions.
{/* i18n message files did not surface "login" via rg, so keys need manual inspection. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- i18n message files did not surface `login` via `rg`, so keys need manual inspection for placement.
 {/* Auth locale keys live in frontend/src/i18n/messages/zh-CN/auth.ts and frontend/src/i18n/messages/en-US/auth.ts. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Auth locale keys live in `frontend/src/i18n/messages/{zh-CN,en-US}/auth.ts`.
 {/* Repo locale keys live in frontend/src/i18n/messages/zh-CN/repos.ts and frontend/src/i18n/messages/en-US/repos.ts for member/invite copy. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo locale keys live in `frontend/src/i18n/messages/{zh-CN,en-US}/repos.ts` for member/invite copy.
{/* Auth register returns status 'pending_verification' with email/expiresAt (no token) when verification is required. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Auth register returns `status: pending_verification` with `email`/`expiresAt` (no token) when verification is required.
{/* Repo invite emails link to /#/accept-invite with email+token query params. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo invite emails link to `/#/accept-invite` with `email` + `token` query params.
{/* RepoDetailPage builds a local tabs items array for sections; new member management should add another item there. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- RepoDetailPage builds a local `items` array for section tabs; member management should add another item there.
{/* RepoDetailPage maps tab labels to sections via an items array and section() helper; rendering happens later. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- RepoDetailPage maps tab labels to sections via an `items` array and `section()` helper.
{/* ScrollableTable wrapper exists for consistent table rendering; can be reused for member/invite lists. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- `ScrollableTable` wrapper exists for consistent table rendering; can be reused for member/invite lists.
{/* Common UI strings live in frontend/src/i18n/messages/zh-CN/core.ts (e.g. common.delete/cancel/save). docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Common UI strings live in `frontend/src/i18n/messages/zh-CN/core.ts` (e.g. `common.delete`, `common.cancel`, `common.save`).
{/* AppShell now tracks register flags from /auth/me and routes unauth users to register/verify/invite pages. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- AppShell now tracks register flags from `/auth/me` and routes unauth users to register/verify/invite pages.
{/* Repo detail will use derived permission flags (canManageRepo/canDeleteRepo/canManageMembers) for UI gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo detail will use derived permission flags (`canManageRepo`, `canDeleteRepo`, `canManageMembers`) for UI gating.
{/* Robot create/edit handlers should be gated by repoReadOnly in RepoDetailPage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Robot create/edit handlers should be gated by `repoReadOnly` in `RepoDetailPage`.
{/* Repo detail robot handlers and save operations now use repoReadOnly for RBAC gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo detail robot handlers and save operations now use `repoReadOnly` for RBAC gating.
{/* Located multiple repoArchived/credentialsSaving disable sites for RBAC gating updates in RepoDetailPage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Located multiple `repoArchived`/`credentialsSaving` disable sites for RBAC gating updates in `RepoDetailPage`.
{/* RepoDetailPage has multiple repoReadOnly usage points in render (forms/buttons) that need RBAC comments. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- RepoDetailPage has multiple `repoReadOnly` usage points in render (forms/buttons) that need RBAC comments.
{/* Automation panel now uses repoReadOnly for RBAC gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Automation panel now uses `repoReadOnly` for RBAC gating.
{/* SkillSelectionPanel already uses repoReadOnly and now has RBAC inline comment. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- SkillSelectionPanel already uses `repoReadOnly` and now has RBAC inline comment.
{/* repoReadOnly now appears in multiple render blocks (credentials, automation, skills, modals) for gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- `repoReadOnly` now appears in multiple render blocks (credentials, automation, skills, modals) for gating.
{/* Repo task-group token revoke button now uses repoReadOnly gating. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repo task-group token revoke button now uses `repoReadOnly` gating.
{/* RepoDetailPage robot section now hides create/actions when repoReadOnly and updates dependencies. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- RepoDetailPage robot section now hides create/actions when `repoReadOnly` and updates related dependencies.
{/* Robot/model credential modals now use repoReadOnly for disabling actions. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Robot/model credential modals now use `repoReadOnly` for disabling actions.
{/* Remaining repoArchived checks are now only for archive banners; gating uses repoReadOnly. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Remaining `repoArchived` checks are now only for archive banners; gating uses `repoReadOnly`.
{/* Added roleOptions and resolveInviteStatus helpers for member/invite UI in RepoDetailPage. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Added `roleOptions` and `resolveInviteStatus` helpers for member/invite UI in `RepoDetailPage`.
{/* Verified remaining repoArchived usage is limited to archive banners in repo detail UI. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Verified remaining `repoArchived` usage is limited to archive banners in repo detail UI.
{/* Added repo member/invite/danger translations in zh-CN/en-US repos message files. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Added repo member/invite/danger translations in `repos` locale files.
{/* Verified member/invite render block and invite revoke fragment structure. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Verified member/invite render block and invite revoke fragment structure.
{/* Migration uses tables repo_members, repo_member_invites, email_verification_tokens for tests. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Migration uses tables `repo_members`, `repo_member_invites`, `email_verification_tokens` for tests.
{/* Auth API docs only list login/me; need to add register + verify-email operations. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Auth API docs only list login/me; need to add register + verify-email operations.
{/* Repository API docs need member/invite/delete operations added. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Repository API docs need member/invite/delete operations added.
{/* User docs repository configuration page updated with member management section. docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- User docs repository configuration page updated with member management section.
{/* Backend test suite runs via "pnpm --filter hookcode-backend test" (jest). docs/en/developer/plans/multiuserauth20260226/task_plan.md multiuserauth20260226 */}
- Backend test suite runs via `pnpm --filter hookcode-backend test` (jest).

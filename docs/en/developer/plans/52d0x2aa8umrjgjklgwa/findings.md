<!-- Capture the initial requirements and discoveries for shared global bot configuration planning. docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md 52d0x2aa8umrjgjklgwa -->
# Findings & Decisions: Global bot configuration shared across repositories
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}
{/* Keep the recorder findings template single-pass so new sessions do not duplicate sections. docs/en/developer/plans/planning-recorder-subagent-20260320/task_plan.md planning-recorder-subagent-20260320 */}

{/* Link discoveries to code changes via this session hash. 52d0x2aa8umrjgjklgwa */}

## Session Metadata
- **Session Hash:** 52d0x2aa8umrjgjklgwa
- **Created:** 2026-04-13

## Requirements
{/* WHAT: What the user asked for, broken down into specific requirements. WHY: Keeps requirements visible so you don't forget what you're building. WHEN: Fill this in during Phase 1 (Requirements & Discovery). EXAMPLE: - Command-line interface - Add tasks - List all tasks - Delete tasks - Python implementation */}
{/* Captured from user request */}
- Support global-level bot configurations that are created centrally instead of per repository.
- Implement admin-managed global robot support instead of stopping at design-only planning.
- Support global-level provider credentials in addition to global robot definitions.
- Allow repositories to reuse those global bot configurations during task execution.
- Make global robots visible to all repositories by default.
- Keep global robots read-only from repository context.
- Allow global robots to reference centrally managed global provider credentials.
- Preserve repository-level bot configurations and distinguish them from global-level configurations.
- Expose explicit origin information in selection UIs so users can tell whether a bot comes from the repository scope or the global scope.
- Expose explicit origin information in APIs so downstream clients can make the same distinction reliably.
- Reuse the existing session hash and keep the resulting planning documents authoritative for continued implementation work.
- Reuse the existing session after baseline commit `c00eeb6` instead of starting a new session for the first hardening batch.
- Finish the first hardening batch with DTO validation for system global robot create and update, controller tests, DTO tests, and i18n cleanup for the new global robot and global credential UI strings.
- Validate the first hardening batch and prepare a clean follow-up commit once the changes land.
- Continue the same hardening session after first hardening batch commit `0249536` instead of starting a separate session.
- Focus the next hardening batch on disabled-global-robot execution guards and stronger backend error handling.
- Continue the same hardening session after disabled-global-robot hardening commit `4b2afe3` instead of starting a separate session.
- Focus the next hardening batch on stabilizing global credential validation and error handling in the system admin flow.
- Continue the same hardening session after global-credentials validation hardening commit `04bf5de` instead of starting a separate session.
- Focus the next adjacent hardening batch on the remaining user and repository credential validation paths that still rely on message matching.

## Research Findings
{/* WHAT: Key discoveries from web searches, documentation reading, or exploration. WHY: Multimodal content (images, browser results) doesn't persist. Write it down immediately. WHEN: After EVERY 2 view/browser/search operations, update this section (2-Action Rule). EXAMPLE: - Python's argparse module supports subcommands for clean CLI design - JSON module handles file persistence easily - Standard pattern: python script.py <command> [args] */}
{/* Key discoveries during exploration */}
- The session directory `docs/en/developer/plans/52d0x2aa8umrjgjklgwa/` was already created during the first initialization attempt, so the correct recovery action was reuse rather than regeneration.
- The task is inherently cross-functional because centralized bot definitions affect configuration storage, runtime resolution during task execution, API contracts, and selection UI labeling.
- The user requirement is not only reuse but also transparent origin labeling, which implies the final design needs first-class origin metadata instead of UI-only heuristics.
- Initialization already synced `docs/docs.json`, so the new plan pages are discoverable through the docs navigation without additional manual updates.
- The current robot system is repository-scoped end to end, and there is no existing global or system robot entity to extend directly.
- Prisma currently defines only `RepoRobot` in `backend/prisma/schema.prisma`, so supporting global bots will require a new persistence model rather than a flag on an existing global table.
- Backend robot CRUD is exposed as repository-scoped routes in `backend/src/modules/repositories/repositories.controller.ts` under `/repos/:id/robots`.
- Runtime resolution for webhook, chat, and task-group flows assumes repository robots loaded from `repoRobotService.listByRepo(repoId)`, so execution paths currently have no shared/global lookup layer.
- Frontend robot pickers in task-group chat, onboarding, task detail, and automation call `listRepoRobots(repoId)` and treat the response as repository-only data.
- The existing admin settings area is the natural navigation surface for managing centrally created global robots.
- `frontend/src/pages/UserSettingsPage.tsx` already exposes an admin-only settings navigation shell, and its generic settings area is the most likely insertion point for global robot management.
- Frontend automation and chat selectors currently model robots as simple repository robot options with `value = id` and display-only labels, so they do not preserve origin or scope metadata.
- Automation action payloads currently persist only `robotId`, which means scope-aware selection will require either globally unique robot identifiers or an explicit scope/origin field in API contracts.
- The user selected a direct-sharing product model: global robots are centrally managed by admins and repositories can use them without editing or overriding the shared configuration.
- The user selected universal visibility: global robots should be visible to all repositories by default in both selection flows and runtime execution entry points.
- The backend application wiring already separates repository-scoped HTTP/controllers from generic system and admin-oriented modules, which gives the implementation a natural boundary for new global robot APIs.
- `RepositoriesModule` currently exports repository services only, so a new global robot service can either live beside repositories or in a dedicated admin/system module and still be imported into task and webhook runtime flows.
- The current worktree is only dirty because the planning recorder created `docs/docs.json` changes and the active session directory; there are no unrelated code changes detected yet.
- The `System` module is lightweight and mostly exposes authenticated runtime APIs, while admin-only CRUD patterns already exist in controllers such as workers, logs, and costs.
- Existing code frequently uses small controller-local `requireAdmin` helpers instead of a shared admin controller base, so a new admin global-robot controller can follow that established convention.
- Task summary contracts currently expose robot id, name, permission, and enabled state but no scope/origin field, so mixed-scope task detail rendering will require explicit type changes on both backend and frontend.
- Existing admin management endpoints commonly use `AuthScopeGroup('system')`, which makes global robot CRUD a better fit for a system-level admin API than for repository-scoped routes.
- `UserSettingsPage` already renders a concrete settings tab body, so an admin-only global robot management panel can be inserted there without introducing a new route.
- The frontend repository API layer is the current home for robot-related calls, so mixed-scope available-robot fetches can extend that area while admin global-robot CRUD can live in a separate system-facing API file.
- `automationEngine` depends on only a small subset of robot fields, so it should be possible to generalize it to a shared robot runtime shape without rewriting its rule logic.
- The current Swagger and TypeScript robot contracts hardcode `repoId` as a required field, which means global robot responses need a new DTO and type instead of pretending to be repository robots.
- Remaining direct `repoRobotService` runtime consumers are concentrated in agent execution, chat, webhook execution, workers internal APIs, repositories controller preview and test routes, and task or task-group metadata assembly.
- `TasksModule` and `WebhookModule` already depend on `RepositoriesModule`, so exporting a new shared robot resolver from `RepositoriesModule` will make it available to chat, task, and webhook consumers without additional top-level module wiring.
- The frontend already has a dedicated `frontend/src/api/system.ts` module for admin settings data, which is the right client location for admin global-robot CRUD calls.
- Task and webhook consumers are the first runtime paths that need to move from repository-only robot lookup to shared robot resolution.
- `Task`, `TaskGroup`, `ApprovalRequest`, and similar tables store `robotId` as a loose UUID field with no foreign key to `repo_robots`, so global robot ids can be persisted without rewriting existing task and task-group relations.
- Repo automation and onboarding UI currently receive repository robots as props from `RepoDetailPage`, so that page will need an additional available-robots fetch or derived mixed-scope state while keeping the repository robot management tab repository-only.
- Agent execution and workers internal context APIs still return repository-only robot lists, so remote execution bundles and worker context must be broadened to include global robots for tasks that reference them.
- The product scope now includes global provider credentials as well as global robots, so the implementation needs both a global robot resource and a global credential store that those robots can reference.
- Current robot and provider auth code already models credential sources such as user, repository, and robot, so adding a new `global` source is the most natural extension point.
- Global credentials affect both repository-provider authentication and model-provider authentication resolution, so resolver code and UI forms will need coordinated updates.
- `repoRobotAccess` already supports falling back to default profiles when `profileId` is omitted, so global-scope credentials can resolve through the same profile model without inventing new selection semantics.
- `UserService` and `RepositoryService` already normalize profile-based repository-provider and model-provider credential JSON structures with `defaultProfileId`, so a global credential store can reuse that shape.
- Frontend account settings already has mature profile-management UI for provider credentials, which can be mirrored for admin global credentials instead of introducing a brand-new editor model.
- `providerCredentialResolver.ts` is the single shared resolution path for model-provider authentication across agent execution, repository dry-run, user model listing, and provider routing.
- The shared resolver already separates local, robot-embedded, repository-scoped, and user-scoped credentials, so adding a stored `global` source there will propagate global model credentials through most execution paths automatically.
- Repository dry-run, agent execution, and repositories controller model-listing all call this resolver, so extending it is the highest-leverage backend change for global credential support.
- `repo-robot.service.ts` already accepts `repoCredentialSource = global` and marks repository robots with `scope = repo`, which confirms part of the mixed-scope backend scaffolding is already landed.
- `repositories.controller.ts` still normalizes `repoCredentialSource` as `robot`/`user`/`repo` only, so controller-layer support for global credentials and mixed-scope robot listings is still incomplete.
- The repository dry-run path still loads repository-only robots and does not yet pass global credentials into provider credential resolution, so runtime execution remains inconsistent with the new schema and service layer.
- `RobotCatalogService` already exposes mixed-scope listing and task-summary map helpers, so the remaining implementation work should reuse that service instead of adding a second aggregation path.
- `GlobalCredentialService` stores repository-provider and model-provider profiles using the same normalized shape as user credentials, which confirms the new global credential store fits the existing profile model.
- `GlobalRobotsController` already exists under `/system` and exposes admin CRUD plus replace-style global credential management, so the admin HTTP surface is already partially wired.
- Remaining repository-only runtime consumers are `agent.ts`, `webhook.execution.ts`, `workers-internal.controller.ts`, `task.service.ts`, and `repositories.controller.ts`.
- `repositories.controller.ts` still keeps robot list/create endpoints repository-only, hardcodes robot credential validation to `robot`/`user`/`repo`, and resolves model-listing credentials from repository and user sources only.
- `task.service.ts` `attachMeta` and `attachGroupMeta` still query `db.repoRobot` directly, so task and task-group summaries cannot currently represent global robots.
- `agent.ts` `resolveExecution` and `buildRemoteExecutionBundle` still load repository-only robots and only pass user and repository credentials into repository-provider and model-provider resolution.
- `workers-internal.controller.ts` still exposes repository-only robots and does not return global credentials to remote workers.
- `webhook.execution.ts` and `chat.controller.ts` both depend on repository-only robot service types, so automation and chat flows still cannot select global robots.
- `tasks-swagger.dto.ts` `TaskRobotSummaryDto` still requires `repoId` and lacks `scope` and `modelProvider` fields, which is now inconsistent with the updated task-domain types.
- Create and update repo robot DTO descriptions still document `repoCredentialSource` as `robot`/`user`/`repo` only, so the Swagger-facing credential contract has not been refreshed for `global`.
- `repositories-swagger.dto.ts` still exposes repository robots only, and the mixed-scope available-robots or global-robot responses are not defined there yet.
- Frontend repository API types already define `GlobalRobot` and `AvailableRobot`, but existing API/page code still references repository-only source unions in several request and UI paths.
- `resolveProviderExecutionCredential` already accepts `globalCredentials`, and its requested stored-source contract already includes `global`, so the shared model-provider resolver is ready for mixed-scope callsites.
- `repoRobotAccess` helpers already support global repository-provider credentials, but `RepoProviderCredentialSource` still excludes `global` while `GlobalAwareRepoProviderCredentialSource` includes it.
- `repo-robot-dry-run.ts` still accepts repository-only `RepoRobotWithToken` shapes and only forwards user and repository model credentials.
- `global-robot.service.ts` defaults `repoCredentialSource` to `global` and returns a `GlobalRobotWithTokenLike` shape with `modelProviderConfigRaw`, which confirms the global robot service already exposes the data needed by shared execution paths.
- `promptBuilder` and the related execution code mostly rely on shared robot fields, so global robots should flow through with a shared robot union once the list sources are widened.
- `backend/src/types/globalRobot.ts` already defines `GlobalRobotWithTokenLike`, which is suitable for mixed-scope runtime unions.
- `repositories-swagger.dto.ts` still defines repository-only robot responses and needs dedicated DTOs for scoped robot, global robot, and available-robot payloads.
- `frontend/src/api/repos.ts` still only exposes repository robot listing, and its request unions mostly stop at `robot`/`user`/`repo`.
- `frontend/src/api/system.ts` currently only exposes tools, runtime, and preview admin APIs, so no frontend admin client exists yet for global credentials or global robot management.
- `RepoDetailPage` robot forms still normalize `repoCredentialSource` as `user`/`repo`/`robot` only and currently load repository-scoped robots only.
- `UserSettingsPage` already has an admin settings surface and credential-editor patterns that can host global credential and global robot controls.
- The active continuation context says backend implementation is largely complete and the backend build now passes, so the main delivery risk has shifted to frontend completion, tests, and final validation.
- Remaining expected work is frontend mixed-scope UI and API wiring, coverage for the new behavior, checking whether any migrations are still missing, and final recorder sync/finalization.
- The current frontend worktree already contains in-progress edits across repository and task pages plus system APIs, while the new backend global-robot and global-credential surfaces are present but still need final frontend integration in this run.
- `RepoDetailPage` already imports `AvailableRobot` helpers, tracks `availableRobots` state, and refreshes available robots alongside repository fetches, but the remaining UI branches still need to recognize the `global` credential source and the mixed robot catalog.
- `UserSettingsPage` still has no admin UI wired for global provider credentials or global robot management even though supporting system APIs now exist in `frontend/src/api/system.ts`.
- `RepoDetailPage` already has `availableRobots` state, `refreshAvailableRobots`, and a sorted mixed robot list, but multiple submit, test, and validation branches still collapse `repoCredentialSource` or `credentialSource` back to `user`/`repo`/`robot` and need explicit `global` handling.
- The robot form UI still needs source selectors, options, and dependent field behavior to support global credentials for both repository-provider credentials and model-provider credentials.
- `frontend/src/api/system.ts` already exposes `fetchGlobalCredentials`, `replaceGlobalCredentials`, and CRUD helpers for global robots, so the missing frontend work is mainly page-level admin presentation and form logic.
- `RepoDetailPage` already sorts mixed available robots with repository-first ordering and uses `listAvailableRepoRobots` during refresh, which confirms the selection surfaces are intended to consume both repository and global robots.
- `frontend/src/api/types/repos.ts` already defines `GlobalRobot` and `AvailableRobot = RepoRobot | GlobalRobot`, and `frontend/src/utils/robot.tsx` already formats labels using robot scope.
- The remaining frontend implementation is therefore concentrated in form option rendering, validation and submit normalization, and an admin page section for global credentials and global robots.
- `RepoDetailPage` has partially upgraded source unions in some workflow-test branches, but the main submit path, initial-value normalization, and profile auto-pick effects still treat repository credential source and model credential source as `user`/`repo`/`robot` only.
- The credential-source `Select` components in `RepoDetailPage` still omit the `global` option for both repository-provider credentials and model-provider credentials.
- Placeholder inline comments containing `docs/en/developer/plans/<SESSION_HASH>/task_plan.md <SESSION_HASH>` are still present and must be replaced with the active plan path and session hash before the implementation is considered complete.
- Backend runtime paths, repository controllers, and worker, chat, and webhook flows already thread `globalCredentials` through execution and validation, which confirms the feature is implemented beyond a shallow API shell.
- Frontend repository types already expose `GlobalRobot` and `AvailableRobot` unions, but some adjacent response enums such as dry-run credential summaries still look `repo`/`user`/`robot` oriented and may need follow-up once the frontend build is run.
- The repository page still needs a frontend-readable source of global credential metadata even though admin-only system endpoints already exist for managing those credentials.
- `frontend/src/utils/robot.tsx` already emits explicit `Repo` and `Global` labels for mixed-scope robot options, which matches the user requirement for source visibility without adding another label helper.
- There are no existing i18n keys for global credential source options in the repository robot form, so the fastest safe path is to add explicit English labels and messages for the new `global` source choices where needed.
- Frontend model-list APIs currently exist only for account credentials and repository-scoped credentials, not for global credential profiles.
- `RepoDetailPage` therefore needs to treat global model credentials as a manual-model-entry flow, with optional default-profile behavior, instead of assuming the model picker can enumerate models for global sources.
- `GET /system/global-credentials` returns only `UserModelCredentialsPublic` data without secrets, while `PUT /system/global-credentials` performs full replacement based on raw credential normalization.
- A naive frontend JSON editor or public-object round-trip would erase existing tokens and API keys because the client cannot reconstruct secrets from the public response payload.
- Backend now has an incremental `PATCH` path for global credentials alongside the original replace path, which allows admin profile edits without clearing unchanged secrets.
- `UserSettingsPage` now has admin-only global credential and global robot management UI wired in progress, while `RepoDetailPage` has had its global-source form branches completed.
- The backend system module already exposes the new controller changes, so the remaining verification work is mainly frontend API export correctness plus TypeScript and build cleanup.
- `pnpm --filter hookcode-frontend build` now passes after the mixed-scope repository UI changes and admin settings additions.
- `pnpm --filter hookcode-backend build` also passes after casting the DTO at the controller boundary for the new global-credential patch endpoint.
- Existing unit-test patterns such as `backend/src/tests/unit/userModelCredentials.test.ts` make it straightforward to add a focused `GlobalCredentialService` test, while the Prisma migrations directory does not yet obviously show a migration for the new global robot and global credential tables.
- `RepositoriesController` unit tests now need a `RobotCatalogService` provider in their Nest test modules, and one constructor-based test also needs both `RobotCatalogService` and `SkillsService` arguments added explicitly.
- `WorkersInternalController` unit tests now need the newer `SkillsService` constructor argument.
- Several unit tests that build `RepoRobot` fixtures now need the required `scope: 'repo'` field, and webhook execution tests now need `robotCatalogService` stubs where older `repoRobotService` stubs were previously sufficient.
- `RobotCatalogService.getByIdWithToken` falls back to `GlobalRobotService.getByIdWithConfig` without checking enabled state, while `listAvailableByRepoWithToken` returns only enabled global robots.
- `GlobalRobotsController` still logs raw error objects with `console.error` in credential and robot mutation endpoints.
- `GlobalRobotService` validates worker references and shared config fields, but it does not currently validate `repoCredentialProfileId` against the persisted global credential settings.
- The controller relies on broad body schemas and message-string matching for several 400 mappings.
- `RepoDetailPage` already disables model listing when the selected credential source is global and renders explicit helper text explaining that the admin-managed global credential will be used.
- `TaskDetailPage` falls back to a synthetic repository-scoped robot summary only when the task payload lacks robot metadata and the repository robot lookup misses the id.
- `frontend/src/utils/robot.tsx` uses direct `Global` and `Repo` scope labels instead of i18n strings.
- `RepoDetailPage` and `UserSettingsPage` now contain new user-visible English strings, but the codebase already mixes translated and non-translated strings in several existing management screens.
- `TaskService` populates `task.robot` via `RobotCatalogService.buildTaskRobotSummaryMap` when the robot id exists, so `TaskDetailPage` usually receives a scoped robot summary directly from the backend.
- The new test file contains only two direct unit cases for global credential patching, although broader regressions are still indirectly covered by the full backend suite updated for the new scope field.
- Global provider credentials are stored in JSONB just like the existing user and repository model credential profiles, so the plaintext-at-rest concern is broader than this feature and not a newly introduced regression.
- Existing controllers across the codebase already use `console.error(err)` patterns and some string-matching validation branches, so those report items are valid quality issues but are not isolated to this feature.
- Main execution paths use `listAvailableByRepoWithToken` or `listEnabledWithConfig` and then filter enabled robots, so the audit report overstates `getByIdWithToken` as a task-execution bug.
- A stale global `repoCredentialProfileId` is not validated on save, and runtime token resolution can silently fall back to the default or first available global profile instead of failing explicitly.
- `RepoDetailPage` already disables the model picker for global credential sources, so the reported runtime-throw UX issue is largely mitigated in the current UI.
- `UserSettingsPage` already catches `JSON.parse` syntax errors for the global robot editor on submit, so missing real-time validation is a UX enhancement rather than a correctness bug.
- `repoRobotAccess` currently resolves explicit profile ids by falling back to the default or first profile within the same store, which can silently swap credentials after a profile deletion.
- `providerCredentialResolver` has the same exact-profile fallback behavior for model-provider credentials before it decides whether cross-layer fallback is needed.
- `GlobalRobotService` can be extended with `GlobalCredentialService` validation to reject stale explicit global profile ids at save time without changing repository or user profile semantics.
- The current worktree already contains the full global robots and global credentials implementation across backend, frontend, migration, tests, docs, and planning artifacts.
- A small hardening follow-up set remained outside the earlier finalized snapshot: the `credentialProfiles` helper, exact-profile resolution updates, global robot save-time validation, sanitized controller logging, and the new focused unit test.
- The worktree is now clean after commit `c00eeb6`, so the first follow-up batch starts from a committed shared-global and hardening baseline.
- There are no existing controller tests for `GlobalRobotsController`, so the first-batch backend coverage work will need a new focused unit test file rather than extending an existing controller test.
- Frontend i18n messages are centralized in `frontend/src/i18n/messages/en-US.ts` and `frontend/src/i18n/messages/zh-CN.ts`.
- Existing DTOs live under `backend/src/modules/system/dto` and `backend/src/modules/repositories/dto`, so the new system global robot DTOs should follow that placement pattern.
- `GlobalRobotsController` still uses broad `ApiBody` schemas and `body: any` for the create and update global robot endpoints.
- Existing repository robot DTOs already cover most of the same shape, including `modelProviderConfig`, `dependencyConfig`, and `timeWindow` fields, so the new system DTOs can mirror that structure with a narrower source union.
- Controller unit tests in this codebase commonly instantiate controllers with `Nest TestingModule` plus direct provider mocks, which fits a focused `GlobalRobotsController` unit test file.
- Frontend message composition is split by domain under `frontend/src/i18n/messages/en-US` and `frontend/src/i18n/messages/zh-CN`, so the new strings should be added under the `repos` domain pack rather than the root aggregator files.
- The active continuation context says the current in-progress hardening batch already includes DTO validation, controller tests, DTO tests, and i18n cleanup, so the remaining planning problem is finishing and verifying that bounded set rather than reopening broad feature work.
- Uncommitted backend changes in the first hardening batch are currently limited to global robot request DTO and controller wiring plus two new unit test files.
- Uncommitted frontend changes in the first hardening batch are currently limited to repository and global scope i18n cleanup in `RepoDetailPage`, `UserSettingsPage`, `robot.tsx`, and the `repos` locale files.
- `pnpm --filter hookcode-frontend build` now passes after the i18n cleanup, so the new locale keys and repository or global scope labels are wired correctly on the frontend side.
- The targeted backend tests and backend build currently fail in `global-robots.controller` because `CreateGlobalRobotDto` leaves `name` and `promptDefault` optional while `createRobot` still expects required strings.
- The backend update path also fails because `UpdateGlobalRobotDto.dependencyConfig` is currently typed as `unknown` while `updateRobot` expects `RobotDependencyConfig | null | undefined`.
- The current worktree is code-clean; only `docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md` is modified by the recorder flow at this point.
- `RobotCatalogService.getByIdWithToken` still falls through from `repoRobotService.getByIdWithToken(id)` directly to `globalRobotService.getByIdWithConfig(id)`.
- That fallback bypasses the enabled-only list methods, so disabled global robots may still be resolved in runtime execution paths when referenced by id.
- `RobotCatalogService.listAvailableByRepo` and `listAvailableByRepoWithToken` already use `globalRobotService.listEnabled` and `listEnabledWithConfig`, so picker and webhook list flows stay on enabled global robots only.
- `RobotCatalogService.getByIdWithToken` still returns `globalRobotService.getByIdWithConfig(id)` without any enabled check.
- Webhook execution loads enabled robots by repository list and then filters `robot.enabled` again, so the higher-risk gap is in direct-id execution callers rather than in normal automation listing.
- The only mixed-scope direct-id lookup is `RobotCatalogService.getByIdWithToken`, which is used by `RepositoriesController.getAvailableRobotWithConfig` for dry-run and saved-robot helper flows.
- `ChatController` uses `robotCatalogService.getById` and then explicitly rejects disabled robots, so it is not currently the bypass path.
- Worker internal and webhook execution paths consume enabled-only robot lists, which already exclude disabled global robots.
- The baseline feature commit `c00eeb6` and the first hardening batch commit `0249536` are complete, so the next batch starts from that combined baseline rather than from the original feature boundary.
- The next likely high-priority fixes are preventing disabled global robots from being executed through mixed-scope direct-id runtime lookups and reducing brittle error mapping in the global robot admin controller.
- The worktree was code-clean after commit `4b2afe3`, so the next hardening step could stay tightly scoped to global credential validation and controller error handling instead of reopening broader mixed-scope runtime work.
- `GlobalRobotsController.patchGlobalCredentials` previously mapped validation to `400` via `message.includes('remark is required')`, which made the system-level global-credentials `PATCH` flow brittle until the service/controller path was hardened.
- `GlobalCredentialService.updateCredentials` previously threw raw `Error` strings for missing model-provider and repo-provider profile remarks, and that pattern was the remaining system-level validation gap before commit `04bf5de`.
- `normalizeHttpBaseUrl` fails closed to `undefined` rather than throwing, so the global-credentials validation risk was concentrated in missing profile remarks rather than in base-url parsing.
- The global-credentials validation hardening batch added stable `GlobalCredentialValidationError` codes/details for the missing-remark cases, removed controller-side substring matching in `patchGlobalCredentials`, and passed targeted plus full backend validation before commit `04bf5de`.
- `replaceCredentials` was intentionally left unchanged in that batch because `normalizeUserModelCredentials` already fails closed without surfacing the same remark-validation errors.
- The worktree is code-clean after commit `04bf5de` except for recorder-owned planning churn, so the next adjacent batch can stay focused on the remaining user and repository validation paths.
- `user.service.updateModelCredentials` still throws raw `Error` strings for missing model-provider and repo-provider profile remarks, and `repository.service.updateRepository` still throws the same raw strings for repository-scoped credential profile remarks.
- `users.controller` and `repositories.controller` still convert those failures into `400` responses via `message.includes(...)` matching.
- `user.service.updateModelCredentials` and `repository.service.updateRepository` now look close enough to the already-hardened global flow that a shared credential-validation helper is likely the cleanest next step instead of another pair of local error classes.
- Backend hardening commits through `29340a0` are complete, so the next continuation can stay tightly scoped to the frontend Vitest regression introduced after `TaskDetailPage` started calling `listAvailableRepoRobots`.
- `frontend/src/pages/TaskDetailPage.tsx` now imports and calls `listAvailableRepoRobots(repoIdResolved)` in a `useEffect` to recover task robot metadata when the task payload is missing pieces such as `modelProvider`.
- `frontend/src/tests/appShell.test.tsx` still mocks `../api` with `listRepoRobots` only and omits `listAvailableRepoRobots`, which causes the current missing-export failure while rendering routes that include `TaskDetailPage`.
- `frontend/src/api.ts` re-exports `frontend/src/api/repos.ts`, and the real `listAvailableRepoRobots` export already exists there, so the current regression is a stale test-mock contract rather than a missing product export.
- `frontend/src/tests/taskDetailPage.test.tsx` also mocks `../api` and still references `listRepoRobots`, so the first repair batch should patch both the `appShell` and `taskDetailPage` mocks together.
- `TaskDetailPage` only needs `listAvailableRepoRobots` as a fallback when `task.robot.modelProvider` is missing, so baseline rendering can use an empty array, but the existing provider-label assertion path in `taskDetailPage.test.tsx` needs a matching available-robot entry instead.
- `taskDetailPage.test.tsx` currently waits for `api.listRepoRobots` and asserts the summary strip shows the provider label `codex`, so both the mocked function name and the expectation must move to `listAvailableRepoRobots` to match the current component behavior.
- Returning an available robot object with id `bot1`, scope `repo`, repoId `r1`, and modelProvider `codex` is enough to preserve the existing provider-label assertion path without changing product code.
- `frontend/src/utils/robot.tsx` now formats task robot labels as `${name} / ${provider} / ${scopeLabel}`.
- `frontend/src/pages/TaskDetailPage.tsx` also renders separate permission, scope, and provider tags before that formatted label, so the old exact-text assertion `Robot bot1` no longer matches the current summary strip content.
- The remaining frontend failure is therefore a stale UI assertion rather than another missing API mock surface.
- The correct repair is in `taskDetailPage.test.tsx`: assert the current combined label or assert the name/provider/scope pieces separately, rather than reverting the page back to the old summary text.
- The updated assertion should avoid brittle exact-text matching across tag wrappers because `TaskDetailPage` now splits the visual summary into multiple rendered nodes.
- `frontend/src/tests/repoDetailPage.test.tsx` also mocks `../api` without `listAvailableRepoRobots`, so `RepoDetailPage` effects now fail there for the same stale-export reason.
- `frontend/src/tests/taskGroupChatPage.composer.test.tsx` still waits on `api.listRepoRobots` and still expects the older robot-label format, so its failure is a stale helper plus stale assertion combination rather than a product regression.
- `frontend/src/tests/taskGroupChatPageTestUtils.tsx` is the shared mock source for task-group chat specs, and it still defines and resets `listRepoRobots` instead of `listAvailableRepoRobots`.
- `frontend/src/pages/taskGroupChatPage/useTaskGroupWorkspaceData.ts` now builds robot labels via `formatRobotOptionLabel`, so visible selector text is `Robot 1 / codex / Repo` instead of the older `Robot 1 / codex`.
- The current frontend blockers are therefore narrower than the earlier scan suggested: `appShell` and `taskDetailPage` are no longer the active blockers once they include the new export, while `repoDetailPage` still needs the local export and task-group chat still needs its shared helper plus composer assertions updated.
- A `repoDetailPage` fix only needs the missing `listAvailableRepoRobots` export added to its local `../api` mock, while the task-group chat fix must update both the shared test helper and the composer assertions that still reflect the old selector label format.
- After the frontend stale-mock and stale-assertion fixes, the remaining root test failures now come from backend preview tests that assume unrestricted filesystem and localhost socket access in ways that the current sandbox does not allow.
- `backend/src/tests/unit/previewService.test.ts` creates real workspaces via `buildTaskGroupWorkspaceDir(...)`, which currently resolves under `~/.hookcode/task-groups/...` and fails with `EPERM` in the sandboxed environment.
- `backend/src/tests/unit/previewPortPool.test.ts` relies on real localhost port availability checks, so allocating from hard-coded local port ranges can fail nondeterministically in the shared environment even when the product logic is correct.
- `backend/src/tests/unit/previewWsProxy.test.ts` starts real HTTP or WebSocket listeners on `127.0.0.1` and fails with `listen EPERM` in this environment.
- These preview failures are test hermeticity problems rather than product regressions, so the fastest safe repair path is to redirect preview workspace roots into temporary directories and stub port or socket probing where the behavior under test does not require real OS resources.
- The next preview-test pass should inspect production override points first instead of rewriting preview runtime behavior just to satisfy the sandbox.
- `backend/src/agent/agent.ts` already exports `TASK_GROUP_WORKSPACE_ROOT` and the related workspace builders, and existing coverage in `buildRootResolution.test.ts` shows the workspace root can already be redirected through test-controlled configuration.
- There are no existing tests that stub `PreviewPortPool` port probing or `PreviewWsProxyService` socket behavior, which confirms the current failures are still coming from real OS resource usage rather than from hermetic test doubles.
- The cleanest preview-test repair path is now clearer: redirect `previewService` workspace creation into a temporary root, stub `PreviewPortPool.isPortAvailable` to deterministic values, and replace `previewWsProxy` real socket servers with mocked net/http interactions when localhost binds are blocked.
- The remaining preview-test discovery question is how `resolveTaskGroupWorkspaceRoot` is configured at module-import time so `previewService.test.ts` can override it safely before the tested module is loaded.
- `backend/src/modules/tasks/preview.service.ts` imports `buildTaskGroupRootDir` and `buildTaskGroupWorkspaceDir` directly from `../../agent/agent`, so `previewService` tests can redirect workspace paths by mocking that module instead of changing production root-path resolution.
- `agent.ts` derives `TASK_GROUP_WORKSPACE_ROOT` through `backend/src/utils/workDir.ts`, and there is no separate standalone `resolveTaskGroupWorkspaceRoot` module to override directly.
- That means the safest backend fix for `previewService` remains test-level module mocking around the agent workspace builders rather than adding a new production seam just for test control.
- The remaining open preview question is whether `previewWsProxy` has any existing auth/socket seam in its current imports; if not, that test should also move to mocked net/http behavior instead of binding real localhost listeners.
- `preview.service.ts` uses `buildTaskGroupWorkspaceDir` during task scanning and `buildTaskGroupRootDir` for the fallback group-root scan, so a path-only hermetic test fix must override both builders together to keep all `previewService` cases inside a temporary root.
- `previewWsProxy` still needs its own seam because it binds sockets directly instead of going through the `PreviewService` workspace helpers.
- `backend/src/tests/unit/previewService.test.ts` uses `buildTaskGroupWorkspaceDir` in exactly four tests, which matches the four `EPERM` failures seen in the root test run.
- The repo-preview display test near the end of `previewService.test.ts` follows the same workspace-builder pattern, so one file-scope tmp-root redirection helper or spy setup should cover every currently failing `previewService` case consistently.
- No additional `previewService` cases currently appear to depend on the real `~/.hookcode` root, so test-level redirection looks low risk.
- The stabilized test batch ultimately resolved both stale frontend available-robot mocks and sandbox-incompatible preview-test resource usage without requiring product-code behavior changes.
- Root `pnpm run test` execution now completes successfully in the current sandboxed environment, so this stabilization slice has no remaining known risks.
- The shared credential-validation refactor is now the active implementation path, and the controller-side `instanceof` mapping pattern is already validated by a passing `UsersController` credential validation test.
- The current mechanical failure set is narrow: `repository.service` references an out-of-scope repository-provider variable when building repository-scoped validation details, and several tests still assert the older global-only error name/message shape instead of the new stable code/details contract.
- The repository-provider lookup issue is the only currently reported build-blocking TypeScript error in the shared refactor pass.
- The shared credential-validation refactor now compiles and passes targeted coverage after fixing the repository-provider closure variable and a missing mock reset in `repoScopedCredentials.test`.
- Global, user, and repository credential patch/update flows now share `CredentialValidationError` plus a common remark-required factory helper.
- `UsersController` and `RepositoriesController` now map those service errors via `instanceof` instead of `message.includes(...)` substring checks.
- The full backend suite now passes for the shared credential validation rollout, so the remaining risks are no longer in validation mechanics but in broader follow-up areas such as storage hardening and older non-credential controller branches.

## Technical Decisions
{/* WHAT: Architecture and implementation choices you've made, with reasoning. WHY: You'll forget why you chose a technology or approach. This table preserves that knowledge. WHEN: Update whenever you make a significant technical choice. EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | | argparse with subcommands | Clean CLI: python todo.py add "task" | */}
{/* Decisions made with rationale */}
| Decision | Rationale |
|----------|-----------|
| Keep `52d0x2aa8umrjgjklgwa` as the authoritative session hash for this task. | The current request is a continuation of the same initialization flow, and creating a second session would fragment the planning record. |
| Seed the plan with separate phases for discovery, domain/data modeling, API/UI contract planning, and verification planning. | The feature spans backend and frontend boundaries, so the planning work needs explicit checkpoints for each concern. |
| Record the interrupted first attempt as an issue instead of hiding it. | The recorder should preserve operational context so future resumptions know why the session exists before the user-facing confirmation. |
| Treat global bots as an admin-managed shared resource rather than a user-private settings feature. | The discovered management entry point is the admin settings UI, and the requested reuse model spans multiple repositories rather than one user's private workspace. |
| Prefer first-class origin metadata in API and UI contracts instead of relying on label formatting alone. | The current selector shape loses scope information, and first-class metadata keeps repository/global distinction stable across clients and execution flows. |
| Global robots are read-only from repository context. | The chosen direct-sharing model lets repositories consume centrally managed robots without mutating or overriding their configuration. |
| Global robots are available to all repositories by default. | The user explicitly chose universal visibility across repository selection and execution entry points. |
| Selection UIs must explicitly label whether each robot is repository-level or global-level. | Origin labeling is part of the approved product behavior and must remain visible wherever mixed-scope robots are shown. |
| Keep the recorder-managed docs changes intact while implementation planning continues. | The current dirty worktree only contains expected planning-recorder outputs, so there is no reason to revert or reinitialize them. |
| Add scope/origin to task robot summaries instead of inferring it later in the frontend. | Task detail and mixed-scope rendering need stable backend-provided metadata because current summaries only expose repository-oriented robot fields. |
| Reuse the existing settings tab content instead of creating a new route for global robot management. | `UserSettingsPage` already has the right admin-only insertion point, so adding a panel there avoids unnecessary routing churn. |
| Do not overload `RepoRobotSwaggerDto` with fake `repoId` values for global robots. | The existing contract is explicitly repository-scoped, so mixed-scope contexts need a dedicated shared DTO and type instead of encoding false repository ownership. |
| Put the reusable shared robot resolver service in `RepositoriesModule` and keep admin CRUD on system-scoped HTTP endpoints. | Existing module dependencies already make `RepositoriesModule` reachable from task and webhook flows, while system PAT scope matches admin-only management APIs. |
| Proceed with a new `global_robots` table and mixed-scope aggregation without changing existing task or task-group `robotId` columns. | Current task-related tables already store robot ids as loose UUIDs, so global robot persistence can fit the existing execution references without relation rewrites. |
| Expand credential-source enums and resolution logic to support a new `global` source instead of adding a one-off path only for global robots. | The existing auth model already distinguishes credential origins, so extending that shared mechanism keeps provider resolution consistent across robot, repository, and provider flows. |
| Reuse the existing profile-based credential JSON shape for global credentials. | Current services already normalize profile collections with `defaultProfileId`, which lets global credentials share the same data model and default-resolution behavior. |
| Extend the shared provider credential resolver with `global` source support instead of patching each caller independently. | `providerCredentialResolver.ts` is already the common execution path for model-provider auth, so changing it once covers agent, dry-run, listing, and routing flows consistently. |
| Keep the review focused on validating whether each audit-report item is a real bug or risk versus a non-blocking improvement. | The immediate continuation task is review triage, so the goal is to separate actionable defects from already-handled behavior or broader architectural concerns. |
| Treat the `TaskDetailPage` fallback report as low confidence until a direct execution-path read proves task payloads are missing scoped robot summaries in normal flows. | `TaskService` already populates `task.robot` from `RobotCatalogService` when the id exists, so the reported fallback behavior may be mostly defensive code rather than a live regression. |
| Classify the plaintext credential storage finding as an architectural follow-up instead of a release blocker for this feature. | Global credentials use the same JSONB storage pattern as existing user and repository credential profiles, so the report describes a broader platform concern rather than a new regression introduced here. |
| Recommend immediate fixes only for raw error logging and stale explicit global profile handling. | Those two findings describe concrete feature-adjacent correctness or observability gaps, while the remaining report items are lower-priority hardening or non-blocking improvements. |
| Use exact-match semantics when `credentialProfileId` is explicitly provided. | Falling back to a default or first profile after an explicit id stops matching can silently switch credentials, so explicit ids should fail fast while no-id requests keep the current default or first-profile behavior. |
| Add focused unit coverage for explicit-profile resolution and save-time validation. | The follow-up fixes touch both repository-provider and model-provider credential paths plus global robot save validation, so narrow tests will guard the intended semantics directly. |
| Capture the current workspace in one commit before starting the next cleanup batch. | The user explicitly wants the full shared-global implementation plus the explicit-profile and logging hardening committed together before DTO cleanup, controller tests, and i18n extraction begin. |
| Implement the first follow-up batch with new system DTOs, a new controller unit test file, and extracted i18n message keys. | The workspace is clean after commit `c00eeb6`, existing DTOs already follow module-local patterns, and the frontend message catalogs are centralized in the shared locale files. |
| Mirror the repository robot DTO shape when introducing system global robot DTOs. | The repository DTOs already capture the needed robot editor fields, so reusing that shape with a tighter system-specific source union minimizes contract drift. |
| Put the new UI message keys into the `repos` i18n domain files instead of the root locale aggregators. | The frontend message packs are organized by domain, and the new robot or credential strings belong to repository and settings flows rather than to the top-level locale bootstrap. |
| Treat the current hardening continuation as a narrow cleanup batch rather than a second feature expansion. | The user scoped the next work to DTO cleanup, controller and DTO tests, i18n extraction, validation, and commit prep, so the plan should stay tightly bounded to those items. |
| Align DTO, controller, and service types directly instead of reintroducing `any` or unsafe casts. | The current first-batch validation failures are narrow typing mismatches between the new request DTOs and the existing global robot service contract, so the fix should preserve the type-safety goal of the batch. |
| Guard runtime id-based global robot resolution with enabled-state checks. | Falling through from repository lookup straight to `globalRobotService.getByIdWithConfig` can bypass the enabled-only catalog paths, so the next hardening change should block disabled global robots from being resolved by id. |
| Treat commit `0249536` as the new baseline for the next hardening batch. | The user explicitly said the baseline feature commit `c00eeb6` and the first hardening batch commit `0249536` are complete, so the next planning and validation work should start after those changes. |
| Prioritize disabled global robot execution guards and stronger backend error handling next. | The current audit already narrowed the remaining likely bugs to direct-id disabled global robot resolution and brittle controller error mapping. |
| Treat commit `4b2afe3` as the next baseline for the global-credentials validation batch. | The user explicitly said commits `c00eeb6`, `0249536`, and `4b2afe3` were complete before hardening the remaining global-credentials validation path. |
| Keep the global-credentials validation batch scoped to `GlobalCredentialService` and `GlobalRobotsController`. | The remaining brittle validation mapping in that slice was isolated to the system admin flow, while similar user/repository patterns could wait for a later batch. |
| Treat commit `04bf5de` as the next baseline for the current adjacent hardening slice. | The user explicitly said commits `c00eeb6`, `0249536`, `4b2afe3`, and `04bf5de` are complete before checking the remaining user and repository credential validation paths. |
| Prefer a shared credential-validation helper for the remaining user and repository flows if the test surface stays small enough. | The user/repository services now repeat the same missing-remark validation pattern that was just hardened in the global flow, so one reusable helper is likely cleaner than another round of duplicated local error classes. |
| Keep the shared `CredentialValidationError` code/details contract stable while updating adjacent tests. | The refactor already proves the shared helper shape works conceptually, so the remaining work is mechanical alignment in `repository.service` and test assertions rather than another error-contract redesign. |
| Reuse the same `CredentialValidationError` helper across global, user, and repository credential update flows. | The targeted and full backend validation now pass with one shared helper and controller-side `instanceof` mapping, so the common abstraction is proven and should remain centralized. |
| Patch the stale frontend `../api` mocks before changing product code. | The real `listAvailableRepoRobots` export already exists in `frontend/src/api.ts`, so the current frontend regression is caused by test doubles that lag behind the live API surface. |
| Keep the first frontend repair batch limited to `appShell.test.tsx` and `taskDetailPage.test.tsx`. | The current scans show no direct test references to `listAvailableRepoRobots`, so the failure comes from the shared mocked module surface used by those two tests. |
| Use one repo-scoped available robot fixture in `taskDetailPage.test.tsx` to preserve the provider-label assertion path. | `TaskDetailPage` only needs the fallback API when `task.robot.modelProvider` is missing, so a minimal `bot1` / `r1` / `codex` available-robot entry keeps the existing assertion meaningful without broadening the mock surface. |
| Update the remaining `TaskDetailPage` assertion to match the current composite summary output instead of reverting UI behavior. | The page now intentionally renders separate tags plus a formatted robot label, so the stable fix is a test assertion that follows the current UI contract without depending on one old exact string. |
| Patch task-group chat through its shared test helper rather than per-test local mocks. | `taskGroupChatPageTestUtils.tsx` is the shared mock source for the chat specs, so fixing that helper once is the narrowest way to unblock the composer suite consistently. |
| Update chat composer assertions to the current `formatRobotOptionLabel` output instead of the old provider-only label. | The selector text now intentionally includes scope as `Robot 1 / codex / Repo`, so the correct repair is test-side alignment with the current UI contract. |
| Keep `repoDetailPage` on a local mock-only fix path. | `RepoDetailPage` only needs the missing `listAvailableRepoRobots` export added to its own `../api` mock, so there is no need to widen that part of the repair into shared helper changes. |
| Prefer sandbox-safe override points in preview tests instead of changing preview production behavior. | The current `previewService`, `previewPortPool`, and `previewWsProxy` failures come from test interactions with real home-directory paths and localhost listeners, so test-only workspace and probe overrides are the fastest safe repair path. |
| Reuse the existing workspace-root override path exported from `agent.ts` for preview-service tests when possible. | Current agent/root-resolution coverage already proves the workspace builders can run against alternative roots, so preview tests should piggyback on that supported override instead of inventing a second filesystem seam. |
| Prefer module-level mocking of `../../agent/agent` in `previewService` tests over new production root-path configuration. | `preview.service.ts` already imports the workspace builders directly from that module, so test-level mocking is the narrowest safe fix and avoids unnecessary production behavior changes. |
| Override both preview workspace builders together in `previewService` tests. | The service reaches both `buildTaskGroupWorkspaceDir` and `buildTaskGroupRootDir`, so mocking only one path would still leave fallback scans pointed at sandbox-restricted locations. |
| Use one file-scope tmp-root helper in `previewService.test.ts` for all current workspace-related failures. | The same builder pattern now underlies all four `EPERM` failures plus the repo-preview display case, so one shared setup should keep the fix small and consistent. |

## Issues Encountered
{/* WHAT: Problems you ran into and how you solved them. WHY: Similar to errors in task_plan.md, but focused on broader issues (not just code errors). WHEN: Document when you encounter blockers or unexpected challenges. EXAMPLE: | Empty file causes JSONDecodeError | Added explicit empty file check before json.load() | */}
{/* Errors and how they were resolved */}
| Issue | Resolution |
|-------|------------|
| The first `INIT_SESSION` turn ended after the session files were created but before the task-specific content was written. | Reopened the existing files under `52d0x2aa8umrjgjklgwa` and completed the task-specific initialization in place. |
| The initial product rules for how repository-level and global-level robots interact in selection and execution were undecided. | The user clarified direct sharing, universal visibility, repository-side read-only behavior, and mandatory origin labeling, which closes the product-level uncertainty. |
| The API contract does not yet define whether robot scope should be encoded explicitly or inferred from globally unique IDs during selection and execution. | Leave this as an open product and API design decision because current payloads only store `robotId`, which is insufficient to express mixed-scope behavior unambiguously. |
| The implementation plan still needs to preserve repository robots while merging them with globally shared robots in selectors and runtime resolution. | Carry this forward as the next planning problem so the mixed list behavior does not break existing repo-scoped flows or task execution lookups. |
| The concrete module and controller location for admin global-robot CRUD is still undecided. | Choose between a system/admin-style module boundary, a workers-style standalone controller pattern, or colocating under repositories before runtime consumers are edited. |
| Global robot CRUD and repository-facing robot availability need different API boundaries. | The planned design needs system-level PAT-protected admin CRUD while still exposing a repository-context available-robots endpoint for normal repository consumers. |
| Mixed-scope runtime consumers still need a shared robot type that covers both repository and global robots. | Current DTOs and types require `repoId`, so the implementation needs a new runtime-safe shape before existing consumers can be migrated cleanly. |
| The task and task-group persistence model may still constrain how global robot identifiers can be stored. | Confirm whether existing task or task-group `robotId` fields are loose UUIDs or foreign keys before assuming global robot ids can persist without extra schema rewrites. |
| Remote worker context still exposes only `robotsInRepo`. | Broaden worker and agent execution context before shipping mixed-scope robot support, or tasks that reference global robots will fail during remote execution. |
| Global credentials expand the resolver and form surface beyond robot-only changes. | Update both repository-provider auth resolution and model-provider auth resolution together so global robots can actually authenticate through centrally managed credentials. |
| Adding a `global` credential source will touch enums, validation, and credential resolution in multiple layers. | Plan coordinated updates across provider-config types, backend validators, and credential resolvers so repository and global robots interpret the new source consistently. |
| The shared provider credential resolver enums still lack `global` variants. | Update backend DTOs and matching frontend types together so the new stored-source option remains type-safe across API payloads and execution flows. |
| Runtime and controller wiring are still inconsistent with the newly added schema, services, and types for global robots and global credentials. | Finish controller normalization, mixed-scope available-robot APIs, and dry-run/runtime credential resolution before treating the feature as complete. |
| Mixed-scope services now exist, but major runtime call paths still bypass them. | Route the remaining repository-only consumers through `RobotCatalogService` and the shared credential resolvers so the delivered behavior matches the new backend surface. |
| Global robots and global credentials are still invisible in task metadata and remote execution. | Replace direct `db.repoRobot` and repository-only execution lookups with mixed-scope catalog and credential resolution before validating end-to-end behavior. |
| API contracts and worker/runtime context still encode repository-only robot assumptions. | Update Swagger DTOs, worker payloads, and webhook/chat runtime types together so mixed-scope robot data stays consistent across HTTP and remote execution boundaries. |
| Backend Swagger docs and frontend request unions are now out of sync with the target mixed-scope behavior. | Update DTO descriptions, Swagger response models, and frontend source unions together so API docs and UI state match the implemented global robot and global credential support. |
| Several helper types and dry-run callers still encode repository-only robot assumptions even though the shared resolvers already support global credentials. | Widen the remaining repo-only types and route dry-run/runtime callers through the global-aware helper contracts so shared support reaches all execution paths. |
| API docs still force `repoId` and `hasToken` semantics that do not apply cleanly to global robots. | Add mixed-scope Swagger DTOs instead of stretching repository-only response shapes to cover global robot behavior. |
| The frontend still has no user path to manage admin global credentials or global robots, and repository selectors remain repository-only. | Add system API clients plus admin settings UI, then widen repository-facing selectors to consume mixed-scope robot data with explicit labels. |
| The backend is no longer the primary uncertainty for this session continuation. | Focus the remaining implementation and validation effort on frontend completion, missing tests, migration checks, and recorder finalization. |
| The remaining frontend integration risk is concentrated in `RepoDetailPage` selectors and `UserSettingsPage` admin controls. | Complete the repository-side source selectors and validation first, then add an admin-only global management panel without regressing the existing credential settings UI. |
| Repository management and execution selection now need different frontend behaviors. | Keep repository robot CRUD repository-only while exposing mixed-scope robot selection for execution surfaces and admin-only system management for global robots and global credentials. |
| The frontend already has the core mixed-scope robot primitives. | Finish the UI branches that still assume repository-only sources instead of rebuilding types or label helpers that already exist. |
| `RepoDetailPage` still lacks a single consistent source-resolution path for global credentials. | Add one shared helper and a reliable global-credential data source so validation, profile auto-pick, and submit normalization stop depending on repository-only assumptions. |
| Repository managers may still lack a non-admin-readable source of global credential metadata. | Confirm whether an existing repository endpoint can expose safe global credential metadata; otherwise keep repository-page handling lightweight for global sources until backend exposure is added. |
| The remaining frontend UI work should avoid a broad translation refactor in this turn. | Reuse the existing mixed-scope robot label helper and add only the minimal new English copy required for global credential source options so the UI remains shippable. |
| The current frontend cannot enumerate models from global credential profiles. | Keep the global source usable through manual model entry and default-profile behavior instead of adding a new backend model-listing endpoint during this implementation pass. |
| The current global credential management contract is unsafe for naive full-object editing in the admin UI. | Add or reuse an incremental update workflow that preserves hidden secrets, similar to the existing user credential profile workflow, before shipping admin-managed global credential editing. |
| The remaining risk has shifted from feature design to verification and frontend wiring cleanup. | Resolve frontend API export wiring and any resulting TypeScript or build errors before treating the admin panels and mixed-scope repository forms as ready to ship. |
| The remaining delivery work is now concentrated in tests and migration verification. | Add focused coverage for incremental global credential updates and confirm whether the Prisma schema changes still require a checked-in migration before finalization. |
| The current full backend test failures are mostly mechanical fallout from the mixed-scope robot API changes. | Update fixtures, Nest test providers, and old `repoRobotService` mocks first; then handle the smaller second wave of TaskService and webhook expectation changes that depend on the new mixed-scope robot summary flow. |
| A few high-severity audit findings still need one more execution-path check before they can be classified confidently. | Read the exact `getByIdWithToken` call sites and the remaining runtime resolution paths to decide whether disabled global robots can actually be executed or whether the issue is mainly consistency hardening. |
| The UX and i18n findings from the audit report are mixed in confidence and severity. | Treat the manual-model helper text and direct `Global` or `Repo` labels as likely acceptable for this feature unless a repo-wide i18n standard is being enforced consistently elsewhere. |
| The review classification is now ready for user-facing severity ranking. | The remaining task is to report that raw error logging and stale explicit global profile handling look like the immediate fixes, while the other findings fall into lower-priority hardening, broader architecture, or non-blocking UX buckets. |
| The next implementation blocker is procedural rather than architectural. | The baseline feature and hardening state are already committed in `c00eeb6`, so the current batch can proceed directly to DTO, controller-test, DTO-test, and i18n cleanup work. |
| The current first-batch blocker is a DTO-to-service typing mismatch in the backend global robot controller path. | Align `CreateGlobalRobotDto` and `UpdateGlobalRobotDto` with the service expectations before rerunning targeted backend tests and the backend build, while keeping the type surface strict. |
| Disabled global robots may still be executable through direct id-based runtime lookup. | Inspect the exact runtime callers of `RobotCatalogService.getByIdWithToken` and add a guard plus regression coverage before changing the behavior, so the fix matches real execution paths instead of only hardening the catalog in theory. |
| Enabled-list flows and direct-id flows should be treated separately in the next hardening step. | Repository pickers and webhook list paths already stay on enabled global robots, so the least-breaking fix is to tighten the direct-id lookup path and its callers instead of changing the enabled-list behavior that already matches product expectations. |
| Patch `RobotCatalogService.getByIdWithToken` directly and cover the behavior with regression tests. | The direct-id mixed-scope bypass is now scoped to one catalog method used by repository dry-run and saved-robot helper flows, so fixing that method is the narrowest change with the highest payoff. |

## Resources
{/* WHAT: URLs, file paths, API references, documentation links you've found useful. WHY: Easy reference for later. Don't lose important links in context. WHEN: Add as you discover useful resources. EXAMPLE: - Python argparse docs: https://docs.python.org/3/library/argparse.html - Project structure: src/main.py, src/utils.py */}
{/* URLs, file paths, API references */}
- `AGENTS.md`
- `docs/en/developer/plans/52d0x2aa8umrjgjklgwa/task_plan.md`
- `docs/en/developer/plans/52d0x2aa8umrjgjklgwa/findings.md`
- `docs/en/developer/plans/52d0x2aa8umrjgjklgwa/progress.md`
- `docs/docs.json`
- `backend/src/modules/users/user.service.ts`
- `backend/src/modules/repositories/repository.service.ts`
- `backend/src/modules/users/users.controller.ts`
- `backend/src/modules/repositories/repositories.controller.ts`
- `backend/src/modules/repositories/global-credentials.service.ts`
- `backend/src/tests/unit/globalCredentialService.test.ts`
- `backend/src/tests/unit/globalRobotsController.test.ts`
- `backend/src/tests/unit/userModelCredentials.test.ts`
- `backend/src/tests/unit/usersModelCredentialsController.test.ts`
- `backend/src/tests/unit/repoScopedCredentials.test.ts`
- `backend/src/tests/unit/repositoriesControllerCredentialValidation.test.ts`
- `pnpm --filter hookcode-backend build`
- `pnpm --filter hookcode-backend test -- --runInBand ...`
- `pnpm --filter hookcode-backend test`
- `frontend/src/tests/appShell.test.tsx`
- `frontend/src/tests/taskDetailPage.test.tsx`
- `frontend/src/tests/repoDetailPage.test.tsx`
- `frontend/src/tests/taskGroupChatPage.composer.test.tsx`
- `frontend/src/tests/taskGroupChatPageTestUtils.tsx`
- `frontend/src/pages/TaskDetailPage.tsx`
- `frontend/src/pages/taskGroupChatPage/useTaskGroupWorkspaceData.ts`
- `frontend/src/api.ts`
- `frontend/src/api/repos.ts`
- `backend/src/tests/unit/previewService.test.ts`
- `backend/src/tests/unit/previewPortPool.test.ts`
- `backend/src/tests/unit/previewWsProxy.test.ts`
- `backend/src/tests/unit/buildRootResolution.test.ts`
- `backend/src/agent/agent.ts`
- `backend/src/modules/tasks/preview.service.ts`
- `backend/src/utils/workDir.ts`
- `backend/prisma/schema.prisma`
- `backend/src/types/repoRobot.ts`
- `backend/src/modules/repositories/repositories.controller.ts`
- `backend/src/modules/tasks/task.service.ts`
- `backend/src/agent/agent.ts`
- `backend/src/modules/repositories/repo-robot.service.ts`
- `backend/src/modules/workers/workers-internal.controller.ts`
- `backend/src/modules/webhook/webhook.execution.ts`
- `backend/src/modules/tasks/chat.controller.ts`
- `backend/src/modules/tasks/dto/tasks-swagger.dto.ts`
- `backend/src/modules/repositories/dto/create-repo-robot.dto.ts`
- `backend/src/modules/repositories/dto/update-repo-robot.dto.ts`
- `backend/src/modules/repositories/dto/repositories-swagger.dto.ts`
- `frontend/src/api/types/repos.ts`
- `backend/src/modelProviders/providerCredentialResolver.ts`
- `git status --short`
- `git diff --stat`
- `backend/src/modules/system/global-robots.controller.ts`
- `frontend/src/i18n/messages/en-US.ts`
- `frontend/src/i18n/messages/zh-CN.ts`
- `backend/src/modules/system/dto`
- `backend/src/modules/repositories/dto`
- `backend/src/modules/repositories/dto/create-repo-robot.dto.ts`
- `backend/src/modules/repositories/dto/update-repo-robot.dto.ts`
- `backend/src/tests/unit/repoArchivedReadOnlyApi.test.ts`
- `frontend/src/i18n/messages/en-US/repos.ts`
- `frontend/src/i18n/messages/zh-CN/repos.ts`
- `git status --short`
- `git diff --stat`
- `pnpm --filter hookcode-backend test -- --runInBand src/tests/unit/globalRobotsRequestDto.test.ts src/tests/unit/globalRobotsController.test.ts`
- `pnpm --filter hookcode-backend build`
- `pnpm --filter hookcode-frontend build`
- `git status --short`
- `rg -n "getByIdWithToken|getByIdWithConfig|listEnabledWithConfig|listAllWithConfig|RobotCatalogService|globalRobotService" backend/src`
- `backend/src/modules/repositories/robot-catalog.service.ts`
- `backend/src/modules/repositories/global-robot.service.ts`
- `backend/src/modules/webhook/webhook.execution.ts`
- `rg -n "robotCatalogService.getByIdWithToken\\(|getByIdWithToken\\(" backend/src/modules backend/src/tests | sort`
- `backend/src/modules/repositories/repositories.controller.ts`
- `backend/src/modules/tasks/chat.controller.ts`
- `backend/src/modules/workers/workers-internal.controller.ts`
- `backend/src/services/repoRobotAccess.ts`
- `backend/src/modules/repositories/repo-robot-dry-run.ts`
- `backend/src/modules/repositories/global-robot.service.ts`
- `backend/src/modules/repositories/global-credentials.service.ts`
- `backend/src/modules/system/global-robots.controller.ts`
- `frontend/src/pages/TaskDetailPage.tsx`
- `frontend/src/utils/robot.tsx`
- `backend/src/tests/unit/globalCredentialService.test.ts`
- `backend/src/modules/users/user.service.ts`
- `backend/src/agent/agent.ts`
- `backend/src/services/repoRobotAccess.ts`
- `backend/src/modules/webhook/webhook.execution.ts`
- `frontend/src/pages/UserSettingsPage.tsx`
- `backend/src/modelProviders/providerCredentialResolver.ts`
- `backend/src/agent/promptBuilder.ts`
- `backend/src/types/globalRobot.ts`
- `frontend/src/api/repos.ts`
- `frontend/src/api/system.ts`
- `frontend/src/pages/RepoDetailPage.tsx`
- `frontend/src/pages/UserSettingsPage.tsx`
- `frontend/src/api/types/repos.ts`
- `frontend/src/utils/robot.tsx`
- `backend/src/modules/repositories/repo-robot.service.ts`
- `backend/src/modules/repositories/robot-catalog.service.ts`
- `backend/src/modules/repositories/global-credentials.service.ts`
- `backend/src/modules/system/global-robots.controller.ts`
- `backend/src/modules/webhook/webhook.execution.ts`
- `backend/src/modules/tasks/chat.controller.ts`
- `frontend/src/pages/taskGroupChatPage/useTaskGroupWorkspaceData.ts`
- `frontend/src/components/repoAutomation/TriggerRuleModal.tsx`
- `frontend/src/components/repoAutomation/triggerRuleModal/TriggerRuleActionsSection.tsx`
- `frontend/src/api/types/automation.ts`
- `frontend/src/pages/UserSettingsPage.tsx`
- `frontend/src/components/settings/UserSettingsSidebar.tsx`
- User clarification in conversation
- `backend/src/app.module.ts`
- `backend/src/modules/repositories/repositories.module.ts`
- `backend/src/modules/repositories/repositories-http.module.ts`
- `backend/src/modules/system/system.controller.ts`
- `backend/src/modules/system/system.module.ts`
- `backend/src/modules/workers/workers.controller.ts`
- `backend/src/modules/auth/auth.decorator.ts`
- `backend/src/services/automationEngine.ts`
- `backend/src/types/automation.ts`
- `backend/src/modules/repositories/dto/repositories-swagger.dto.ts`
- `backend/src/modules/tasks/tasks.module.ts`
- `backend/src/modules/webhook/webhook.module.ts`
- `backend/src/types/task.ts`
- `frontend/src/api/types/tasks.ts`
- `frontend/src/api/repos.ts`
- `frontend/src/api/system.ts`
- `frontend/src/components/repoAutomation/RepoAutomationPanel.tsx`
- `frontend/src/pages/RepoDetailPage.tsx`
- `backend/src/agent/agent.ts`
- `backend/src/modules/workers/workers-internal.controller.ts`
- `backend/src/services/repoRobotAccess.ts`
- `backend/src/modules/users/user.service.ts`
- `backend/src/modelProviders/codex.ts`
- `backend/src/modelProviders/claudeCode.ts`
- `backend/src/modelProviders/geminiCli.ts`
- `backend/src/modelProviders/providerCredentialResolver.ts`
- `frontend/src/api/types/auth.ts`
- `git status --short`
- `backend/src/modules/repositories/repositories.controller.ts`
- `rg` callsite search for credential and robot consumers
- `rg` results for `repoRobotService` consumers
- `rg` results for `resolveProviderExecutionCredential` consumers

## Visual/Browser Findings
{/* WHAT: Information you learned from viewing images, PDFs, or browser results. WHY: CRITICAL - Visual/multimodal content doesn't persist in context. Must be captured as text. WHEN: IMMEDIATELY after viewing images or browser results. Don't wait! EXAMPLE: - Screenshot shows login form has email and password fields - Browser shows API returns JSON with "status" and "data" keys */}
{/* CRITICAL: Update after every 2 view/browser operations */}
{/* Multimodal content must be captured as text immediately */}
- No browser or image artifacts were used during initialization; all current findings came from local planning templates, scripts, and the user request.

---
{/* REMINDER: The 2-Action Rule After every 2 view/browser/search operations, you MUST update this file. This prevents visual information from being lost when context resets. */}
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*

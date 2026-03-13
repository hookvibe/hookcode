# Findings & Decisions: Webhook replay and debug center
<!-- Capture webhook replay/debug discoveries and architecture notes. docs/en/developer/plans/webhook-replay-debug-20260313/task_plan.md webhook-replay-debug-20260313 -->

## Session Metadata
- **Session Hash:** webhook-replay-debug-20260313
- **Created:** 2026-03-13

## Requirements
- Upgrade the existing webhook troubleshooting flow into a real event center with payload, signature result, match result, related tasks, replay actions, and debug timeline.
- Keep repo-scoped troubleshooting inside Repo Detail and add a global admin-only view for all webhook failures/replays.
- Support replay of a historical event into real tasks and a dry-run/debug path without side effects.
- Record enough metadata to explain which layer failed and how replay events relate to original events.

## Research Findings
- `backend/prisma/schema.prisma` already has `RepoWebhookDelivery`, and the frontend repo webhooks tab already depends on it, so the lowest-risk architecture is to extend that table instead of creating a second event store.
- Live webhook ingress currently duplicates most logic between `backend/src/modules/webhook/webhook.github.ts` and `backend/src/modules/webhook/webhook.gitlab.ts`; replay should not copy a third variant.
- The action-resolution pipeline already exists via `resolveAutomationActions()` in `backend/src/services/automationEngine.ts`, while `TaskService.createTask()` already returns task/group linkage needed for replay diagnostics.
- Repo-scoped webhook UI already exists in `frontend/src/components/repos/RepoWebhookDeliveriesPanel.tsx`, and admin-only settings tabs already exist in `frontend/src/pages/UserSettingsPage.tsx` plus `frontend/src/components/settings/UserSettingsSidebar.tsx`.
- The repo-level webhooks API currently lives in `RepositoriesController`, but global admin APIs should instead follow the `LogsController` pattern with `@AuthScopeGroup('system')` and an explicit `requireAdmin()` guard.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Extend `RepoWebhookDelivery` with debug/replay fields instead of creating `WebhookEvent` | The existing DB table and repo UI already form the basis of an event center, so extending them is cheaper and keeps compatibility with current repo endpoints. |
| Persist filterable summary columns plus a JSON debug trace | Failure classification, replay linkage, matched rule/robot ids, and payload hash need fast list/detail access, while timeline/debug detail fits naturally in JSON. |
| Refactor the post-validation webhook execution path into shared helpers | Replay must create the same matched actions/tasks as live ingress, so rule resolution and task creation need one shared implementation. |
| Keep repo APIs in `RepositoriesController` for backward compatibility, but add a dedicated admin/global controller in the webhook module | Repo screens can continue using familiar repo endpoints, while admin/global APIs avoid making `RepositoriesController` even larger. |
| Add the admin debug center as a new settings tab (`#/settings/webhooks`) | This matches existing admin-only UI patterns and keeps operational tooling together. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Root repository instructions require session planning docs before implementation | Created a new session folder and updated `task_plan.md`, `findings.md`, and `progress.md` before touching feature code. |
| The current webhook model only stores coarse delivery summaries | Plan to add explicit replay/debug metadata and reuse the detail modal/panel as the richer event center UI. |

## Resources
- `backend/prisma/schema.prisma`
- `backend/src/modules/repositories/repo-webhook-delivery.service.ts`
- `backend/src/modules/webhook/webhook.github.ts`
- `backend/src/modules/webhook/webhook.gitlab.ts`
- `backend/src/services/automationEngine.ts`
- `backend/src/modules/tasks/task.service.ts`
- `backend/src/modules/logs/logs.controller.ts`
- `frontend/src/components/repos/RepoWebhookDeliveriesPanel.tsx`
- `frontend/src/pages/RepoDetailPage.tsx`
- `frontend/src/pages/UserSettingsPage.tsx`
- `frontend/src/components/settings/UserSettingsSidebar.tsx`

## Visual/Browser Findings
- No external browser work was required; all discovery came from local code inspection.

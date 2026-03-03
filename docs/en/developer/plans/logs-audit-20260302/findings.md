# Findings & Decisions: Add admin log system

{/* Link discoveries to code changes via this session hash. logs-audit-20260302 */}

## Session Metadata
- **Session Hash:** logs-audit-20260302
- **Created:** 2026-03-02

## Requirements
- Add a log system with categories: system / execution / operation.
- Log warnings, failures, and meaningful execution outcomes.
- Show logs in the settings panel as a new tab.
- Restrict visibility to admins.
- Retain logs for 30 days (auto cleanup).
- Provide a global logging method so new code changes always write logs.
- Update AGENTS.md with the logging requirement.

## Research Findings
{/* Record the repository status check after handoff. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 */}
- Verified the working tree still contains the log system changes and newly added files after handoff.
- Repository operations (create/update/archive/robot/member/invite/automation) and user account/token endpoints are prime candidates for additional business event logs beyond the generic HTTP audit interceptor. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302
- Backend already has an SSE hub (`EventStreamService`) exposed at `/api/events/stream` with topic filtering.
- Frontend settings are a standalone page with sidebar tabs (`#/settings/:tab`).
- Auth `/api/auth/me` returns `user.roles`, allowing admin-only UI gating.
- Task logs are stored in `tasks.result_json.logs` but there is no system/audit log table.
- Webhook handlers use a shared `WebhookDeps` object, making it possible to inject a log writer for rejection/system events.
- Webhook unit tests build `WebhookDeps` via a helper, so adding logWriter requires adjusting that helper in tests.
- AGENTS.md is the central place for cross-cutting workflow rules, including the new logging requirement.
- Frontend i18n defaults to `zh-CN`, so UI tests should either set locale or assert Chinese labels by default.
- User settings content is rendered via a `switch (activeTab)` in `UserSettingsPage`, so new tabs are added there and in the tab-title map.
- Bootstrap already schedules periodic maintenance timers, making it a natural place to add log retention cleanup and system log emits.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Create a dedicated `SystemLog` table with category/level/message/meta fields | Enables querying/auditing and avoids overloading task logs. |
| Provide `LogWriterService` with `logSystem/logOperation/logExecution` helpers | Gives a global logging API to keep future changes consistent and auditable. |
| Use `EventStreamService` topic `logs` for SSE | Reuses existing SSE infrastructure and avoids new streaming stack. |
| Admin-only access enforced in controller using `RepoAccessService.isAdmin` | Aligns with existing RBAC checks. |
<!-- Document FK decision for audit logs. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 -->
| Keep log foreign keys nullable without DB constraints | Preserve audit logs even when related records are deleted. |

## Audit Review Follow-ups
{/* Track audit report resolutions. docs/en/developer/plans/logs-audit-20260302/task_plan.md logs-audit-20260302 */}
- Fixed `.gitignore` to stop ignoring `backend/src/modules/logs`.
- LogWriterService now reports write failures with throttling.
- AuditLogInterceptor now logs write failures only to reduce duplicate success logs.
- Log retention is configurable via `LOG_RETENTION_DAYS` and deletion runs in batches.
- SSE heartbeat already exists in `EventStreamService` (25s keep-alive), no change needed.
- SSE server-side filtering and full-text search indexing remain future improvements.

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` reported `docs.json` missing navigation.languages[] | Proceeded with plan files creation; will document and continue without auto docs.json sync. |

## Resources
- `backend/src/modules/events/event-stream.service.ts`
- `backend/src/modules/auth/auth.controller.ts` (`GET /auth/me` roles)
- `frontend/src/pages/UserSettingsPage.tsx`
- `frontend/src/components/settings/UserSettingsSidebar.tsx`
- `frontend/src/router.ts` (`SettingsTab` routing)

## Visual/Browser Findings
- None

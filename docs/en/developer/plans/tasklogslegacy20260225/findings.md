# Findings & Decisions: Remove legacy task logs env toggle
{/* Normalize MDX comments for Mintlify rendering. docs/en/developer/plans/mintlify-docs-20260301/task_plan.md mintlify-docs-20260301 */}
{/* Rename findings title to avoid legacy env name. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. tasklogslegacy20260225 */}

## Session Metadata
- **Session Hash:** tasklogslegacy20260225
- **Created:** 2026-02-26

## Requirements
{/* Rephrase requirements without the legacy env name. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
- Remove the legacy task logs env toggle so only `TASK_LOGS_DB_ENABLED` and `TASK_LOGS_VISIBLE_ENABLED` remain.
- Clean up related logic, tests, env examples, and documentation references.

## Research Findings
{/* Capture the legacy fallback without naming the removed env var. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
- `backend/src/config/features.ts` previously fell back to a legacy toggle when the new vars were unset, and `isTaskLogsEnabled()` returns `db && visible`.
- CI env generation in `docker/ci/write-ci-env.sh` writes `TASK_LOGS_DB_ENABLED=true` and `TASK_LOGS_VISIBLE_ENABLED=false` by default, which supersedes legacy values.
{/* Clarify compose behavior without referencing removed env names. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
- `docker/docker-compose.yml` does not set task log env toggles at runtime; it relies on the shared `docker/.env` file.
- Backend unit tests include legacy coverage in `backend/src/tests/unit/taskLogsFeatureToggle.test.ts`.
{/* Record cleanup status after removing legacy references. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
- After cleanup, repository search no longer finds legacy task log toggle references in code or docs.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
{/* Update decision wording to remove legacy env name. docs/en/developer/plans/tasklogslegacy20260225/task_plan.md tasklogslegacy20260225 */}
| Remove the legacy fallback in `features.ts` and delete legacy toggle references from env examples/docs | Enforce a single, explicit configuration path to avoid confusion and misconfiguration in CI/prod |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| None | N/A |

## Resources
- backend/src/config/features.ts
- docker/ci/write-ci-env.sh
- docker/.env.example, backend/.env.example
- backend/src/tests/unit/taskLogsFeatureToggle.test.ts

## Additional Notes
- `backend/.env.example` and `docker/.env.example` already list only the new task log toggles (no legacy env entry).
- `rg` shows live code references to the legacy toggle only in `backend/src/config/features.ts` and `backend/src/tests/unit/taskLogsFeatureToggle.test.ts`; other matches are in historical plan docs.
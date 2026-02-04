# Findings & Decisions: Fix automation disable timeWindow validation
{/* WHAT: Your knowledge base for the task. Stores everything you discover and decide. WHY: Context windows are limited. This file is your "external memory" - persistent and unlimited. WHEN: Update after ANY discovery, especially after 2 view/browser/search operations (2-Action Rule). */}

{/* Link discoveries to code changes via this session hash. automation-disable-20260204 */}

## Session Metadata
- **Session Hash:** automation-disable-20260204
- **Created:** 2026-02-04

## Requirements
- Disable event/trigger actions in repo automation UI should not fail validation.
- Fix "Automation rule timeWindow is invalid" error on PUT `/api/repos/:id/automation` when disabling.
- Check similar validation logic for other automation updates to avoid regressions.

## Research Findings
- Backend validation in `backend/src/modules/repositories/repo-automation.service.ts` throws `Automation rule timeWindow is invalid` when a rule includes a `timeWindow` property but normalization returns null.
- `normalizeTimeWindow` returns null for non-records, so `timeWindow: null` currently fails validation.
- Frontend `TriggerRuleModal` saves `timeWindow` as `timeWindow ?? undefined`, but config normalization in `RepoAutomationPanel` preserves existing rule objects; if a rule already has `timeWindow: null`, it remains in the config payload.
- Full test suite is `pnpm test` (runs backend + frontend tests). Backend tests use Jest via `pnpm --filter hookcode-backend test`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Allow null/undefined timeWindow in backend validation | Matches "no time limit" semantics and avoids errors when disabling rules/events |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
|       |            |

## Resources
- `backend/src/modules/repositories/repo-automation.service.ts`
- `backend/src/utils/timeWindow.ts`
- `frontend/src/components/repoAutomation/TriggerRuleModal.tsx`
- `frontend/src/components/repoAutomation/RepoAutomationPanel.tsx`
- `package.json`
- `backend/package.json`
- `docs/en/change-log/0.0.0.md`

## Visual/Browser Findings
- None.

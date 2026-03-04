# Findings & Decisions: Fix worker stuck after unknown reasoning parameter error

## Session Metadata
- **Session Hash:** worker-stuck-reasoning-20260304
- **Created:** 2026-03-04

## Requirements
- User reports online worker error: `Unknown parameter: 'reasoning'` from remote compact task execution.
- After that error, worker appears stuck: no new docker logs and no logs for newly created tasks.
- Need end-to-end investigation and fix.

## Research Findings
- Session planning files initialized successfully for this incident.
- Initial symptom points to model-provider request-shape mismatch plus possible worker loop liveness issue.
- Production task `715159db-8604-4eb5-a743-a2cf817bba86` is `failed` with `Error running remote compact task ... Unknown parameter: 'reasoning'`.
- The same task group has a later task `96b8a7ab-b7d7-4624-9990-354ce7ef3c14` stuck in `processing` and logs stop exactly at a Codex `{\"type\":\"error\", ...}` event.
- No queued tasks are pending, but one long-lived processing task blocks that task group, matching user-observed “worker appears stuck”.
- In backend code, `reasoning` originates from Codex SDK thread options via `modelReasoningEffort` in `buildCodexSdkThreadOptions`.
- TaskRunner/worker loops are resilient in principle; the observed stall is consistent with provider-level execution not returning after an error event.
- Implemented fix in Codex provider:
  - Retry once without `modelReasoningEffort` when the gateway reports unknown `reasoning` parameter.
  - Abort stream reads and perform bounded iterator close after terminal error events to avoid infinite processing hangs.
- Added unit coverage for compatibility detection, retry behavior, and non-hanging error handling.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Analyze provider request builder and worker runner loop together | Need both root-cause and liveness guarantees |
| Add Codex compatibility retry without reasoning effort on unknown-parameter errors | Keeps execution compatible with OpenAI-compatible gateways that reject `reasoning` |
| Abort Codex stream reads immediately after terminal error events | Prevent provider hangs that leave tasks in perpetual `processing` |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` docs nav check failed | Proceeded with created session files and logged issue |

## Resources
- `docs/en/developer/plans/worker-stuck-reasoning-20260304/task_plan.md`
- `backend/src/modelProviders/codex.ts`
- `backend/src/modules/tasks/task-runner.service.ts`
- `backend/src/worker.ts`
- `backend/src/tests/unit/codexExec.test.ts`
- `backend/src/tests/unit/codexProviderConfig.test.ts`

## Visual/Browser Findings
- None.

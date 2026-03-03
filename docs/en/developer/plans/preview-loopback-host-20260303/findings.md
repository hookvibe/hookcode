# Findings & Decisions: Investigate 127.0.0.1 preview access issue
<!-- Capture discovery notes for preview loopback mismatch. docs/en/developer/plans/preview-loopback-host-20260303/task_plan.md preview-loopback-host-20260303 -->

## Session Metadata
- **Session Hash:** preview-loopback-host-20260303
- **Created:** 2026-03-03

## Requirements
- Diagnose why HookCode preview cannot be accessed via `127.0.0.1:10000` but can via `localhost:10000`.
- Provide root-cause explanation and project-side fix.

## Research Findings
- The active project has `.hookcode.yml` at repository root.
- Planning session initialization script created files but failed to sync docs navigation because `docs/docs.json` lacks `navigation.languages[]`.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Investigate `.hookcode.yml` and preview runtime host resolution before patching | Avoid blind config changes and ensure fix targets true root cause |
| Fix the frontend preview command argument forwarding in `.hookcode.yml` | Confirmed this is the direct cause of `localhost`-only binding and `127.0.0.1` access failures |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| Planning template generated duplicated content previously | Replaced with clean focused session document |

## Resources
- `.hookcode.yml`
- `docs/en/developer/plans/preview-loopback-host-20260303/task_plan.md`

## Visual/Browser Findings
- Not applicable yet (no browser/PDF/image inspection used in this task).

## Discovery Log (2026-03-03)
- `.hookcode.yml` currently sets frontend preview command to `pnpm dev -- --host 127.0.0.1 --port {{PORT:frontend}}`.
- `.hookcode.yml` backend env also uses `127.0.0.1` placeholders for console links.
- `hookcode-yml-generator` reference states preview runtime injects `HOST=127.0.0.1` by default.
- Likely mismatch is not from root config alone; need inspect runtime URL assembly or process env precedence.
- `backend/src/modules/tasks/preview.service.ts` forces preview process env `HOST=127.0.0.1` and readiness probe uses socket to `127.0.0.1`.
- Frontend Vite config does not hardcode server host, but `.hookcode.yml` command already passes `--host 127.0.0.1`.
- Initial evidence suggests runtime startup path is already IPv4-biased; issue likely comes from URL exposure/rewriting/client access path rather than process bind env.
- Reproduced command behavior in `frontend`: `pnpm dev -- --host 127.0.0.1 --port 10000` launches `vite "--" "--host" ...`; Vite reports `Local: http://localhost:10000/` and `Network: use --host to expose`, proving host flag is ignored.
- Reproduced corrected behavior: `pnpm dev --host 127.0.0.1 --port 10001` launches `vite "--host" ...`; Vite reports `Local: http://127.0.0.1:10001/`, proving this syntax applies host binding correctly.
- The issue root cause is command syntax in `.hookcode.yml` frontend preview command, not backend preview runtime logic.
- Implemented fix in repository root `.hookcode.yml`: `pnpm dev --host 127.0.0.1 --port {{PORT:frontend}}`.

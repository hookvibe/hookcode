# Findings & Decisions: Create root-level feature roadmap plans
<!-- Capture why these root-level roadmap files were chosen and how they map to HookCode's architecture. docs/en/developer/plans/rootfeatureplans20260313/task_plan.md rootfeatureplans20260313 -->

## Session Metadata
- **Session Hash:** rootfeatureplans20260313
- **Created:** 2026-03-13

## Requirements
- Create several plan files directly under the HookCode repository root.
- Make the plans detailed rather than outline-only.
- Focus the plans on future features that fit the current HookCode product.
- Provide a clear priority recommendation instead of an unordered list.

## Research Findings
- The active project root is `/Users/gaoruicheng/Documents/Github/tmp/hookcode-copy-1`.
- HookCode already has strong foundations around repos, robots, task groups, workers, provider execution, layered credentials, logs, previews, and notifications.
- The highest-value next features are the ones that reuse those foundations instead of introducing an unrelated subsystem.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Choose five roadmap topics instead of too many smaller notes | A smaller set is more actionable and easier to prioritize. |
| Include backend/frontend/data/API sections in each file | The user asked for detailed plans, so each document should already be implementation-guiding. |
| Put the files in the repo root, not under `docs/` | The request explicitly targeted the current root directory. |
| Add a separate `ROADMAP_INDEX.md` | This makes it easy to scan the roadmap without opening every file first. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` emitted a `docs.json missing navigation.languages[]` error | Treated as non-blocking because the session files were created correctly. |

## Resources
- Root roadmap files: `ROADMAP_INDEX.md`, `ROADMAP_01_PROVIDER_ROUTING_AND_FAILOVER.md`, `ROADMAP_02_ROBOT_DRY_RUN_AND_PLAYGROUND.md`, `ROADMAP_03_APPROVAL_GATES_AND_POLICY_ENGINE.md`, `ROADMAP_04_WEBHOOK_REPLAY_AND_DEBUG_CENTER.md`, `ROADMAP_05_BUDGET_QUOTA_AND_COST_GOVERNANCE.md`
- Planning session: `docs/en/developer/plans/rootfeatureplans20260313/`

## Visual/Browser Findings
- No browser or image analysis was needed for this planning-only task.

# Task Plan: Reorganize task-groups layout
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. taskgroups-reorg-20260131 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** taskgroups-reorg-20260131
- **Created:** 2026-01-31

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
<!-- Define the workspace layout change target for this task. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
Restructure task-group workspaces to use a taskgroup-id directory containing the repo clone and Codex artifacts, add a task-group .env + AGENTS template with PAT config, update command execution to run inside that folder, and document the new layout while wiring codex-schema outputSchema handling + frontend next-action suggestions. <!-- Extend goal for codex-schema output schema + suggestions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 4

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
<!-- Mark discovery complete and move to planning. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
<!-- Mark planning complete and start implementation. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Wire codex-schema.json into Codex TurnOptions outputSchema + frontend structured output/suggestions
- [x] Update tests for structured output + suggestion click behavior
<!-- Implementation done for .env + AGENTS template updates. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [ ] Verify all requirements met
- [x] Document test results in progress.md
- [ ] Fix any issues found
<!-- Tests executed with environment-related failures; keep verification open. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
- **Status:** in_progress

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Where is the task-group workspace path and repo clone path derived today?
2. Which code paths move/emit `codex-output.txt`, `codex-schema.json`, and `AGENTS.md`?
3. Which command executors (codex/claude/gemini) set a working directory, and how should it change?
4. What tests already cover workspace paths, and what new tests are needed?
5. Where should HOOKCODE_API_BASE_URL and HOOKCODE_PAT values be sourced for task-group `.env` generation?
6. How should structured Codex output be parsed to keep existing result rendering while adding next-action suggestions?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
<!-- Record structural decisions for the new task-group layout. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| Decision | Rationale |
|----------|-----------|
| Store task-group roots at `task-groups/<taskGroupId>` and place repo clones under that root using the repo-name segment derived from `repoSlug`. | Matches requested folder layout while keeping repo root available for config/git operations. |
| Add a task-group root helper and keep `buildTaskGroupWorkspaceDir` returning the repo directory under the new root. | Minimizes call-site churn while enabling root-level artifacts and command execution. |
| Run Codex/Claude/Gemini with working directory set to the task-group root and allow output files to be moved into that root after execution. | Satisfies the requirement to execute commands at the task-group level and store artifacts alongside the repo. |
| Build task-group `.env` and AGENTS template from runtime `HOOKCODE_API_BASE_URL`/`HOOKCODE_PAT` values, emitting the same env content verbatim into AGENTS. | Keeps secrets out of source control while meeting the requirement to surface runtime credentials for skills. |
| Include `HOOKCODE_TASK_GROUP_ID` in the task-group `.env` derived from the current task group id. | Ensures skills can scope API calls to the active task group. |
<!-- Record base URL normalization choice for task-group env generation. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| Normalize task-group API base URLs to host roots (strip `/api` when present). | Aligns with skill usage that appends `/api` paths and matches the requirement to use the backend's running address. |
<!-- Record .codex seeding and per-skill env sync decisions. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| Seed task-group `.codex` from backend/src/agent/example/.codex and copy task-group .env into each `.codex/skills/*/.env`. | Keeps bundled skills available in every task group and ensures skill scripts inherit the same API/PAT configuration. |
<!-- Record PAT scope change required for highlight POST endpoints. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| Require task-group PATs to include tasks:write and rotate existing tasks:read tokens. | Enables preview highlight POST APIs that need write-level task scope. |
<!-- Record codex-schema structured output decision. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| Use codex-schema.json to define structured output (output + next_actions) and parse it in the frontend for suggestions. | Keeps Codex outputs structured while preserving existing result rendering. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| previewPortPool/previewWsProxy jest failures (EPERM/no_available_preview_ports) | 2 | Pending; likely environment port binding restrictions. |
<!-- Log latest backend test timeout with preview port pool failure. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| previewPortPool jest failure (no_available_preview_ports) with pnpm test timeout | 3 | Pending; likely environment port binding restrictions. |
<!-- Log full-suite test rerun failures for preview port + ws proxy. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| previewPortPool no_available_preview_ports + previewWsProxy EPERM/timeout on full test rerun | 4 | Pending; likely environment port binding restrictions. |
<!-- Log additional test rerun failure after AGENTS changes. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| previewPortPool no_available_preview_ports + previewWsProxy EPERM/timeout on rerun after AGENTS update | 5 | Pending; likely environment port binding restrictions. |
<!-- Log test rerun after PAT scope update. docs/en/developer/plans/taskgroups-reorg-20260131/task_plan.md taskgroups-reorg-20260131 -->
| previewPortPool no_available_preview_ports + previewWsProxy EPERM/timeout on rerun after PAT scope update | 6 | Pending; likely environment port binding restrictions. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

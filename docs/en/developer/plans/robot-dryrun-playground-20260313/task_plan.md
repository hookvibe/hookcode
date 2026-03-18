# Task Plan: Robot Dry Run and Prompt Playground
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. robot-dryrun-playground-20260313 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** robot-dryrun-playground-20260313
- **Created:** 2026-03-13

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Add a repo-robot dry-run/playground flow that previews the final prompt, provider resolution, and a side-effect-free model run directly from the robot editor.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Phase 5

## Phases
{/* WHAT: Break your task into 3-7 logical phases. Each phase should be completable. WHY: Breaking work into phases prevents overwhelm and makes progress visible. WHEN: Update status after completing each phase: pending → in_progress → complete */}

### Phase 1: Requirements & Discovery
{/* WHAT: Understand what needs to be done and gather initial information. WHY: Starting without understanding leads to wasted effort. This phase prevents that. */}
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
{/* STATUS VALUES: - pending: Not started yet - in_progress: Currently working on this - complete: Finished this phase */}

### Phase 2: Planning & Structure
{/* WHAT: Decide how you'll approach the problem and what structure you'll use. WHY: Good planning prevents rework. Document decisions so you remember why you chose them. */}
- [x] Define technical approach
- [x] Create project structure if needed
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Execute the plan step by step
- [x] Write code to files before executing
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Review all output files
- [x] Ensure deliverables are complete
- [x] Deliver to user
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. How can dry-run reuse the existing robot prompt/provider pipeline without creating a second execution stack? (Reuse `buildPrompt`, provider credential resolution, and provider runtimes.)
2. How can execute-no-side-effect remain useful while guaranteeing the repository is untouched? (Run providers in an isolated temporary workspace and never pass repo write-back credentials.)

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Add a dedicated repo dry-run endpoint instead of overloading robot activation/test APIs. | Prompt preview, provider resolution, and sandboxed model output are different concerns from token activation checks. |
| Keep the first UI entry point inside the existing robot editor modal. | The roadmap explicitly targets repo robot editing, and the editor already holds the unsaved draft state the playground must preview. |
| Use a small backend dry-run service plus a separate frontend dialog component. | This avoids adding more controller/page-only logic into already large files and keeps the feature reusable. |
| Support both saved-robot and unsaved-draft dry-run endpoints. | The editor must preview brand-new robots before save and also let existing robots reuse their stored config as the dry-run baseline. |
| Preserve saved provider config unless the playground draft explicitly overrides it. | Dry-run previews must match the real robot configuration, including provider routing/failover settings. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` failed with `docs.json missing navigation.languages[]` after creating the session files. | 1 | Later fixed `docs/docs.json` to use `navigation.languages[].tabs[]`, so the docs sync precondition now exists for future runs. |
| Backend compile failed because provider-specific config fields were accessed from an unresolved union type. | 1 | Narrowed on `runConfig.provider` in both the task runner and dry-run helper, and normalized controller DTOs before passing them to the helper. |
| Dry-run failover test failed because saved provider config was reset to defaults when no draft override was supplied. | 1 | Updated dry-run config merging to preserve the saved config unless the draft changes the provider or config blob. |
| `pnpm --filter hookcode-docs build` failed because the docs package still calls the removed `mintlify build` command. | 1 | Updated `docs/package.json` so the build script runs `npx mintlify validate`, then reran the docs build successfully. |
| `mintlify validate` failed on repo-wide MDX comment parsing, missing logo assets, and docs navigation warnings. | 1 | Added `docs/logo` assets, converted the remaining whole-line HTML comments under `docs/en` to `{/* ... */}`, aligned `docs/docs.json` with Mintlify language navigation, synced plan navigation, and reran validation successfully. |
| The shared `file-context-planning` skill still failed its own sync tests and Gemini path examples after the docs fixes landed. | 1 | Updated the skill scripts in `.codex`, `.claude`, and `.gemini` to migrate legacy `docs.json` navigation, made `init-session.sh` warn instead of aborting on sync failure, fixed Gemini path drift, and refreshed the self-tests. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

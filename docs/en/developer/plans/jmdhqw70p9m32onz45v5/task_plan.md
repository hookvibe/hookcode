# Task Plan: Repo list creator + pull method UX + repo detail tasks
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. jmdhqw70p9m32onz45v5 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** jmdhqw70p9m32onz45v5
- **Created:** 2026-03-05

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Improve the repo UX by showing each repo creator on list cards, enabling workflow-mode checks before saving robots, surfacing repo-scoped tasks/task-groups in repo overview, and making onboarding stop reappearing once a repo is already configured.

## Current Phase
{/* WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3"). WHY: Quick reference for where you are in the task. Update this as you progress. */}
Complete

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
- [x] Document decisions with rationale
- [x] Confirm API + UI contract changes
- **Status:** complete

### Phase 3: Implementation
{/* WHAT: Actually build/create/write the solution. WHY: This is where the work happens. Break into smaller sub-tasks if needed. */}
- [x] Backend: expose repo creator in repo detail response
- [x] Backend: add draft workflow test endpoint (no saved robot required)
- [x] Frontend: show creator on repo cards, remove redundant manage button
- [x] Frontend: call draft workflow test when robot is unsaved
- [x] Frontend: show repo-scoped task groups (and tasks) in repo overview
- [x] Frontend: make onboarding auto-dismiss when repo is already configured
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [x] Add/adjust backend tests for new workflow test behavior
- [x] Add/adjust frontend tests for repo cards + workflow check + task-group filter route
- [x] Run `pnpm --filter hookcode-frontend test` and `pnpm --filter hookcode-backend test`
- [x] Document results in progress.md
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [x] Update docs/en/change-log/0.0.0.md with summary + plan link
- [x] Use preview highlight skill to point out DOM changes (repo card + repo overview)
- [x] Deliver short implementation summary
- **Status:** complete

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. What should be treated as the "repo creator" (HookCode owner member vs. provider owner), and where do we fetch it from?
2. How do we safely validate workflow mode (direct/fork) before persisting robot tokens?
3. What conditions should auto-dismiss repo onboarding so it does not reappear when the repo is already usable?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Treat "creator" as the earliest `RepoMember` with role=`owner` | Repo rows do not store `createdBy`, but repo creation seeds an owner membership; this matches UI intent without schema changes. |
| Add `POST /repos/:id/workflow/test` for draft credential checks | Allows workflow validation without saving a robot; keeps saved-robot endpoint for existing configs. |
| Auto-dismiss onboarding when repo already has robots | Users consider the repo configured once a robot exists; also fixes reappearing wizard when localStorage is cleared/new device. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| `bash: not found` when running init-session.sh | 1 | Initialized plan files via template copy + placeholder hydration using `sh` + `python3`. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

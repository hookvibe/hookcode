# Task Plan: Handle gemini/claude agent files and templates
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. gemini-claude-agents-20260205 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** gemini-claude-agents-20260205
- **Created:** 2026-02-05

## Goal
{/* WHAT: One clear sentence describing what you're trying to achieve. WHY: This is your north star. Re-reading this keeps you focused on the end state. EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality." */}
Update task-group workspace generation to write Codex guidance into AGENTS.md, Claude Code guidance into CLAUDE.md, and Gemini guidance into GEMINI.md, while copying `.claude` and `.gemini` templates alongside `.codex` during task execution, and ensure Claude Code runs from the task-group (task id) root.

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
- [x] Update Claude Code working directory to task-group root
- [x] Update/extend tests for workspace directory usage
- [x] Update guidance content and logging for Claude workspace root visibility
- [x] Add Claude prompt prefix for workspace root clarity
- **Status:** complete

### Phase 4: Testing & Verification
{/* WHAT: Verify everything works and meets requirements. WHY: Catching issues early saves time. Document test results in progress.md. */}
- [ ] Verify all requirements met
- [x] Document test results in progress.md
- [ ] Fix any issues found
- **Status:** in_progress

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. Where is the task-group workspace generation logic that writes AGENTS.md and copies `.codex`?
2. What tests cover task-group workspace file emission that need updates for CLAUDE.md/GEMINI.md and template copying?
3. How should Claude Code scope tool access when running from the task-group root?

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
| Generate CLAUDE.md and GEMINI.md using the same task-group guidance content as AGENTS.md | Keeps consistent workspace rules and .env embedding across model providers while minimizing new template surface area. |
| Copy `.claude` and `.gemini` templates into task-group roots alongside `.codex` | Ensures provider-specific tooling/skills are present in the workspace where model CLIs run. |
| Align Claude Code tool boundary with the task-group workspace root | Ensures the CLI runs from the task directory and can access task-group instructions without leaving the workspace. |
| Log Claude Code workspace root in task logs | Makes it easy to confirm the CLI runs from the task-group root after restart. |
| Prepend workspace root context to Claude prompt | Prevents Claude from inferring cwd from repo-only tool results. |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
| `pnpm --filter hookcode-backend test` failed (previewService EPERM mkdir; previewPortPool no_available_preview_ports; previewWsProxy EPERM/timeout) | 1 | Unresolved; likely environment/port permission limitations. |
| `pnpm --filter hookcode-backend test` failed again after Claude workspaceDir update | 2 | Same environment/port permission limitations. |
| TSC error: `buildTaskGroupWorkspacePromptPrefix` used before assignment | 1 | Convert helper to function declaration to avoid TDZ and runtime ReferenceError. |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

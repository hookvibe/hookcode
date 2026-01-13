---
name: planning-with-files
version: "3.0.0"
description: "Implements Manus-style file-based planning for complex tasks in Codex CLI. Creates task_plan.md, findings.md, and progress.md in the project root to persist goals, discoveries, and session logs."
---

# Planning with Files (Codex)

Work like Manus: Use persistent markdown files as your "working memory on disk."

## What This Skill Does (Codex-Compatible)

Codex skills are instruction-only. There are **no automatic hooks** (e.g., "PreToolUse", "Stop").

To get the benefits, you must **manually**:
- Create the planning files in your project root
- Re-read `task_plan.md` before major decisions
- Update `task_plan.md`, `findings.md`, and `progress.md` throughout the work

## Operational Checklist (Replace Claude Hooks)

When using this skill on a complex task:

1. If `task_plan.md` / `findings.md` / `progress.md` do not exist, initialize them (script or template copy).
2. Fill `task_plan.md` (goal, phases, key questions) before implementing anything.
3. Before major decisions or phase changes, re-read `task_plan.md` (refreshes goals into the attention window).
4. After every 2 information-gathering actions, append key discoveries into `findings.md` (2-Action Rule).
5. After each phase, update phase status in `task_plan.md` and log what happened in `progress.md`.

## Important: Where Files Go (Repo Layout)

When using this skill:

- **Skill assets** (templates/scripts/reference) live in: `.codex/skills/planning-with-files/`
  - Templates: `.codex/skills/planning-with-files/templates/`
  - Scripts: `.codex/skills/planning-with-files/scripts/`
- **Your planning files** (`task_plan.md`, `findings.md`, `progress.md`) must be created in **your project directory** (your current working directory)

| Location | What Goes There |
|----------|-----------------|
| Skill directory (`.codex/skills/planning-with-files/`) | Templates, scripts, reference docs |
| Your project directory | `task_plan.md`, `findings.md`, `progress.md` |

This ensures your planning files live alongside your code, not buried in the skill installation folder.

## Quick Start

Before ANY complex task:

### Option A: Initialize via Script (Fastest)

Copies templates into your project root if the files do not already exist.

```bash
bash .codex/skills/planning-with-files/scripts/init-session.sh "<project-name>"
```

### Option B: Copy Templates (Most Detailed)

```bash
cp .codex/skills/planning-with-files/templates/task_plan.md task_plan.md
cp .codex/skills/planning-with-files/templates/findings.md findings.md
cp .codex/skills/planning-with-files/templates/progress.md progress.md
```

Then:

1. **Fill `task_plan.md` first** — Goal, phases, key questions
2. **Re-read plan before decisions** — Refreshes goals in the attention window
3. **Update after each phase** — Mark status complete, log errors
4. **Log discoveries continuously** — `findings.md` for knowledge, `progress.md` for session/test logs

Optional completion check:

```bash
bash .codex/skills/planning-with-files/scripts/check-complete.sh task_plan.md
```

> **Note:** All three planning files should be created in your current working directory (your project root), not in the skill's installation folder.

## The Core Pattern

```
Context Window = RAM (volatile, limited)
Filesystem = Disk (persistent, unlimited)

→ Anything important gets written to disk.
```

## File Purposes

| File | Purpose | When to Update |
|------|---------|----------------|
| `task_plan.md` | Phases, progress, decisions | After each phase |
| `findings.md` | Research, discoveries | After ANY discovery |
| `progress.md` | Session log, test results | Throughout session |

## Critical Rules

### 1. Create Plan First
Never start a complex task without `task_plan.md`. Non-negotiable.

### 2. The 2-Action Rule
> "After every 2 information-gathering actions, IMMEDIATELY save key findings to text files."

This prevents visual/multimodal information from being lost.

### 3. Read Before Decide
Before major decisions, read the plan file. This keeps goals in your attention window.

### 4. Update After Act
After completing any phase:
- Mark phase status: `in_progress` → `complete`
- Log any errors encountered
- Note files created/modified

### 5. Log ALL Errors
Every error goes in the plan file. This builds knowledge and prevents repetition.

```markdown
## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| FileNotFoundError | 1 | Created default config |
| API timeout | 2 | Added retry logic |
```

### 6. Never Repeat Failures
```
if action_failed:
    next_action != same_action
```
Track what you tried. Mutate the approach.

## The 3-Strike Error Protocol

```
ATTEMPT 1: Diagnose & Fix
  → Read error carefully
  → Identify root cause
  → Apply targeted fix

ATTEMPT 2: Alternative Approach
  → Same error? Try different method
  → Different tool? Different library?
  → NEVER repeat exact same failing action

ATTEMPT 3: Broader Rethink
  → Question assumptions
  → Search for solutions
  → Consider updating the plan

AFTER 3 FAILURES: Escalate to User
  → Explain what you tried
  → Share the specific error
  → Ask for guidance
```

## Read vs Write Decision Matrix

| Situation | Action | Reason |
|-----------|--------|--------|
| Just wrote a file | DON'T read | Content still in context |
| Viewed image/PDF | Write findings NOW | Multimodal → text before lost |
| Browser returned data | Write to file | Screenshots don't persist |
| Starting new phase | Read plan/findings | Re-orient if context stale |
| Error occurred | Read relevant file | Need current state to fix |
| Resuming after gap | Read all planning files | Recover state |

## The 5-Question Reboot Test

If you can answer these, your context management is solid:

| Question | Answer Source |
|----------|---------------|
| Where am I? | Current phase in task_plan.md |
| Where am I going? | Remaining phases |
| What's the goal? | Goal statement in plan |
| What have I learned? | findings.md |
| What have I done? | progress.md |

## When to Use This Pattern

**Use for:**
- Multi-step tasks (3+ steps)
- Research tasks
- Building/creating projects
- Tasks spanning many tool calls
- Anything requiring organization

**Skip for:**
- Simple questions
- Single-file edits
- Quick lookups

## Templates

Copy these templates to start:

- [templates/task_plan.md](templates/task_plan.md) — Phase tracking
- [templates/findings.md](templates/findings.md) — Research storage
- [templates/progress.md](templates/progress.md) — Session logging

## Scripts

Helper scripts for automation:

- `scripts/init-session.sh` — Initialize all planning files
- `scripts/check-complete.sh` — Verify all phases complete

## Advanced Topics

- **Manus Principles:** See [reference.md](reference.md)
- **Real Examples:** See [examples.md](examples.md)

## Anti-Patterns

| Don't | Do Instead |
|-------|------------|
| Keep todos only in chat memory | Persist the plan in task_plan.md |
| State goals once and forget | Re-read plan before decisions |
| Hide errors and retry silently | Log errors to plan file |
| Stuff everything in context | Store large content in files |
| Start executing immediately | Create plan file FIRST |
| Repeat failed actions | Track attempts, mutate approach |
| Create files in skill directory | Create files in your project |

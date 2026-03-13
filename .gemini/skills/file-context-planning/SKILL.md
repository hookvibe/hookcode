---
name: file-context-planning
version: "4.0.0"
description: "Persistent file-based planning for Gemini CLI. Stores task_plan.md/findings.md/progress.md under docs/en/developer/plans/<session-hash>/ for durable planning, traceability, and long-running task continuity."
---

# Planning with Files (Gemini)

Work like Manus: use markdown files as persistent working memory on disk.

## What This Skill Does

Use this skill for multi-step or long-running tasks where context can drift over time.

It provides a durable planning workflow based on:
- `docs/en/developer/plans/<session-hash>/task_plan.md`
- `docs/en/developer/plans/<session-hash>/findings.md`
- `docs/en/developer/plans/<session-hash>/progress.md`

## Core Workflow

1. Create or choose a stable `session-hash`.
2. Initialize the session folder before implementation.
3. Fill `task_plan.md` first.
4. Re-read `task_plan.md` before major decisions.
5. Log discoveries in `findings.md`.
6. Log execution, tests, and errors in `progress.md`.
7. Add the same session hash in changed code/doc comments for traceability.
8. Update `docs/en/change-log/0.0.0.md` when the work is complete.

## Quick Start

### Initialize a session

```bash
bash .gemini/skills/file-context-planning/scripts/init-session.sh "<session-hash>" "<session-title>"
```

This creates:
- `docs/en/developer/plans/<session-hash>/task_plan.md`
- `docs/en/developer/plans/<session-hash>/findings.md`
- `docs/en/developer/plans/<session-hash>/progress.md`

If `docs/docs.json` exists, the script also attempts to sync Mintlify navigation so the new plan pages stay discoverable.

### Rebuild plan navigation manually

```bash
bash .gemini/skills/file-context-planning/scripts/sync-docs-json-plans.sh
```

Use this when:
- a session folder was created manually
- you want to rebuild the plans navigation deterministically
- `docs/docs.json` changed and you want to resync plan entries

### Check whether all phases are complete

```bash
bash .gemini/skills/file-context-planning/scripts/check-complete.sh <session-hash>
```

### Append a changelog entry

```bash
printf '%s' "<one-line-summary>" | bash .gemini/skills/file-context-planning/scripts/append-changelog.sh "<session-hash>"
```

## Important Behavior

### Docs navigation sync

The shared sync script supports both:
- legacy `navigation.tabs`
- newer `navigation.languages[].tabs[]`

If docs navigation is invalid, `init-session.sh` now warns but still keeps the planning files it created.

### Mintlify-safe docs comments

When editing markdown that Mintlify parses as MDX, avoid HTML comments like:

```md
<!-- comment -->
```

Prefer:

```md
{/* comment */}
```

### Grouped plan navigation

The sync script writes grouped plan entries so each session appears as one collapsible navigation group containing:
- `task_plan`
- `findings`
- `progress`

## Traceability Format

Use this format in changed areas:

`<one sentence in English> <relative-plan-path> <session-hash>`

Examples:
- JS/TS: `// Add retry guard for provider fallback. docs/en/developer/plans/abcd1234/task_plan.md abcd1234`
- Python/Shell/YAML: `# Document preview startup fallback. docs/en/developer/plans/abcd1234/task_plan.md abcd1234`
- Markdown: `{/* Explain why this section changed. docs/en/developer/plans/abcd1234/task_plan.md abcd1234 */}`

## Required Habits

### Plan before acting

Do not start complex work without a session folder and a filled `task_plan.md`.

### The 2-action rule

After every 2 information-gathering actions, write key discoveries to `findings.md`.

### Read before deciding

Before major architecture or implementation decisions, re-read `task_plan.md`.

### Log every error

Record failures and resolutions in `progress.md` and summarize important ones in `task_plan.md`.

### Do not repeat failed actions blindly

If the same approach failed once, change the method before retrying.

## Minimal Session Checklist

- `task_plan.md` exists and has goal + phases
- `findings.md` captures current discoveries
- `progress.md` records implementation and test status
- changed areas include the session hash
- changelog updated before handoff

## Resources

- `scripts/init-session.sh`
- `scripts/sync-docs-json-plans.sh`
- `scripts/check-complete.sh`
- `scripts/append-changelog.sh`
- `templates/task_plan.md`
- `templates/findings.md`
- `templates/progress.md`
- `reference.md`

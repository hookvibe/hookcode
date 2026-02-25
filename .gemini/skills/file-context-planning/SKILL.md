---
name: file-context-planning
description: Persistent file-based planning for Gemini CLI. Stores task_plan.md, findings.md, and progress.md under docs/en/developer/plans/<session-hash>/ for durable planning and traceability. Use this for multi-step tasks to maintain context over long conversations.
---

# Planning with Files (Gemini)

Work like Manus: Use persistent markdown files as your "working memory on disk."

## What This Skill Does

This skill provides a structured workflow for managing complex tasks by persisting state in markdown files.

To use this skill:
1.  **Initialize a session:** Create a folder under `docs/en/developer/plans/<session-hash>/`.
2.  **Plan first:** Fill `task_plan.md` before implementation.
3.  **Trace changes:** Use the session hash in inline code comments.
4.  **Log discoveries:** Continuously update `findings.md`.

## Operational Checklist

1.  **Start Session:** Determine the `SESSION_HASH` (or generate one).
2.  **Initialize:** Run `bash .gemini/skills/file-context-planning/scripts/init-session.sh "<hash>" "<title>"`.
3.  **Fill Plan:** Define goals and phases in `task_plan.md`.
4.  **Work & Update:**
    - Re-read `task_plan.md` before major decisions.
    - Log discoveries in `findings.md`.
    - Update phase status in `task_plan.md` and logs in `progress.md`.
5.  **Traceability:** Add `// ... docs/en/developer/plans/<hash>/task_plan.md <hash>` to code.
6.  **Finalize:** Update `docs/en/change-log/0.0.0.md`.

## Directory Layout

- **Skill Assets:** `.gemini/skills/file-context-planning/`
- **Session Plans:** `docs/en/developer/plans/<session-hash>/`

## Scripts

- `scripts/init-session.sh`: Initialize planning files.
- `scripts/check-complete.sh`: Verify phase completion.
- `scripts/append-changelog.sh`: Add entry to release notes.

## Traceability Format

**Format:** `<one sentence in English> <relative-plan-path> <session-hash>`

Example:
`// Add input validation for webhook payload. docs/en/developer/plans/sddsa89612jk4hbwas678/task_plan.md sddsa89612jk4hbwas678`

## Critical Rules

1.  **Plan Before Act:** Never start a complex task without a session folder.
2.  **The 2-Action Rule:** Save findings after every 2 information-gathering steps.
3.  **Read Before Decide:** Always re-read the plan before making major architectural choices.
4.  **Log All Errors:** Every failure and its resolution must be recorded.
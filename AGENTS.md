HookCode project

# Project overview

## Summary

An AI assistant for GitLab/GITHUB automated analysis: it receives events via Webhooks, enqueues tasks, processes them, and writes results back via the GitLab/GITHUB  API.

## Components

- `frontend`: web console
- `backend`: webhook receiver + worker execution
- Database: remote (shared)

## Working workflow

<!-- Enforce planning-with-files workflow on every invocation for traceability. 0lldjnbw5qxdhw4wwftz -->

1. Determine the active session (NON-NEGOTIABLE)
   - **Check conversation history first**: if this conversation already has an active `SESSION_HASH` and the current request is a continuation/refinement of that task, **reuse the existing SESSION_HASH** (do NOT create a new session).
   - **Only start a new session** if:
     - This is a completely new, unrelated task, OR
     - The previous session is explicitly marked as complete and the user requests a new feature.
   - To start a new session:
     - Start a `planning-with-files` 
     - Decide the `SESSION_HASH` (use user-provided hash; otherwise generate one).
     - Run `bash .codex/skills/planning-with-files/scripts/init-session.sh "<SESSION_HASH>" "<SESSION_TITLE>"` (or run without args to auto-generate a hash).
   - The only source of truth for the plan is: `docs/en/developer/plans/<SESSION_HASH>/`
2. Before ANY implementation, fill the session docs
   - Update `docs/en/developer/plans/<SESSION_HASH>/task_plan.md` (goal, phases, key questions).
   - Capture requirements/discoveries in `docs/en/developer/plans/<SESSION_HASH>/findings.md`.
3. Locate related files (both frontend and backend) and continuously update findings (2-Action Rule)
4. Implement the change
   - Re-read `docs/en/developer/plans/<SESSION_HASH>/task_plan.md` before major decisions.
   - Add/adjust inline comments for every code change (see "Inline comment requirements").
5. After completing each phase or meaningful milestone, return to the session folder and update
   - `task_plan.md`: phase status (pending → in_progress → complete)
   - `progress.md`: actions, touched files, test results, error log
6. Add or update test cases, run tests, and record results in `docs/en/developer/plans/<SESSION_HASH>/progress.md`
7. Delivery checklist (NON-NEGOTIABLE)
   - Ensure all phases are complete (optional helper: `bash .codex/skills/planning-with-files/scripts/check-complete.sh <SESSION_HASH>`).
   - Update `docs/en/change-log/0.0.0.md` with: `SESSION_HASH` + one-line summary + relative link to the plan.
   <!-- Keep changelog entries clean by avoiding redundant HTML comment lines. l290bb7v758opd6uxu6r -->
   - Do NOT add an extra `<!-- ... -->` line above changelog bullets; the bullet (hash + plan link) is enough traceability.

## Inline comment requirements

Goal: Maintain the codebase like an encyclopedia — code and comments evolve together, and every change stays clear, traceable, and easy to understand.

Mandatory rules:
- Write comments inline at the exact code location they describe (do NOT create new `.md` documentation as a substitute for code comments).
- After EVERY code change (add / modify / refactor / bugfix), you MUST also add or update the corresponding inline comments.
- Traceability (NON-NEGOTIABLE): every changed area MUST include a 1-sentence English inline comment that ends with the active `SESSION_HASH`.
  - Format: `<one sentence in English> <SESSION_HASH>`
  - Examples:
    - JS/TS/Go: `// Add input validation for webhook payload. <SESSION_HASH>`
    - Python/Shell/YAML: `# Explain retry backoff behavior. <SESSION_HASH>`
    - SQL: `-- Prevent duplicate inserts via unique key. <SESSION_HASH>`
    - Markdown: `<!-- Update workflow rules to enforce plan sessions. <SESSION_HASH> -->`
<!-- Changelog entries are already self-traceable via the session hash link, so avoid redundant HTML comments there. l290bb7v758opd6uxu6r -->
- Exception: For `docs/en/change-log/*.md` entries, do not add a separate `<!-- ... -->` comment line; keep only the bullet summary + plan link.
- Comments must match the complexity level of the code (simple vs. medium vs. complex), and include the required content below.
- Backend Swagger-related documentation MUST follow Swagger comment format (e.g., OpenAPI/Swagger annotations). Non-Swagger areas follow the rules below.
- All edited code comments and console output MUST be in English.

Complexity-based guidance:
- Simple logic (straightforward, self-explanatory):
  - Add short comments only when it clarifies business meaning, non-obvious intent, or important constraints.
  - Minimum: business intent + usage note (if needed).
- Medium complexity (multiple branches, non-trivial validation, integrations):
  - Explain: what business it implements, which business module/sub-part it belongs to, key steps, and important edge cases.
  - Add: pitfalls/assumptions (e.g., ordering, retries, idempotency, timezones, pagination).
- Complex logic (state machines, concurrency, distributed workflows, critical performance/security):
  - Provide a structured set of inline comments near the code:
    - Business context: module + sub-part + purpose
    - Key workflow steps: what happens first/next/last and why
    - Invariants/constraints: what must always hold true
    - Failure modes: what can go wrong, how it is handled, and what is intentionally NOT handled
    - Safety notes: security, permission boundaries, data sensitivity, rate limits
    - Performance notes: big-O or bottlenecks, caching, batching
    - Pitfalls: known tricky behaviors, footguns, race conditions
    - TODO/Not implemented: clearly mark missing parts and future work

Required content checklist (as applicable):
- Business behavior implemented (what it does)
- Which business module and which part it belongs to
- Key steps and main logic explanation
- Change record (what changed and why) — keep it close to the change site
- Usage (how/where it is used)
- Important notes/caveats/assumptions
- Unimplemented parts / TODOs
- Potential pitfalls and how to avoid them

# AI requirements

- Avoid overthinking; prioritize high-quality, practical code changes.
- Avoid copy-pasting utilities across files. Before adding a helper (env parsing, query parsing, etc.), search the repo and reuse an existing implementation; otherwise, extract it into a shared module (e.g. `backend/src/utils/*`, `frontend/src/utils/*`) and add unit tests.
- Do not revert or delete changes you did not make in this conversation. It is normal to have unrelated changes in the working tree; do not touch or destroy them. If they affect your changes, make your changes compatible on top of them.
- When changing backend code, check whether frontend code also needs updates.
- The project is usually run via `dev` scripts; you do not need to run them unless requested.
- When adding new entries to `.env.*.example`, add a Chinese comment for each entry.
- New features must include tests.
- The system is still in active development with little/no data; backward compatibility for old data is not required. If the DB schema is wrong, it is acceptable to delete and recreate it; optimize for the best design.
- Edited code comments, console output all need to be in English.

## Security requirements

- Never treat frontend-only changes (UI hiding/disable, client-side checks) as a security boundary; all sensitive actions must be enforced on the backend (authz/feature flags/rate limits).
- For any new feature toggle that affects permissions or access control, implement a backend guard and return an explicit error (e.g. 403 + stable error code); the frontend may additionally hide/disable the UI for UX.
- Do not log secrets (tokens, API keys, passwords) or sensitive payloads; redact before logging and avoid returning secrets in API responses.
- Validate and sanitize all user input on the backend; never rely on frontend validation.
- Prefer least-privilege defaults for new endpoints/features; if a feature must be disabled in CI/staging, ensure the backend is also disabled there.

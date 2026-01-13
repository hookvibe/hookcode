HookCode project

# Project overview

## Summary

An AI assistant for GitLab/GITHUB automated analysis: it receives events via Webhooks, enqueues tasks, processes them, and writes results back via the GitLab/GITHUB  API.

## Components

- `frontend`: web console
- `backend`: webhook receiver + worker execution
- Database: remote (shared)

## Working workflow

1. Analyze the given request/context
2. Locate related files (both frontend and backend)
3. Implement the change
4. Add or update inline code comments for every change (see "Inline comment requirements" below)
5. Add or update test cases, and run tests

## Inline comment requirements

Goal: Maintain the codebase like an encyclopedia — code and comments evolve together, and every change stays clear, traceable, and easy to understand.

Mandatory rules:
- Write comments inline at the exact code location they describe (do NOT create new `.md` documentation as a substitute for code comments).
- After EVERY code change (add / modify / refactor / bugfix), you MUST also add or update the corresponding inline comments.
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
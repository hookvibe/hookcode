# Task Plan: open-api-pat-design
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. open-api-pat-design */}

## Session Metadata
- **Session Hash:** open-api-pat-design
- **Created:** 2026-01-30

## Goal
Implement PAT management (create/list/update/revoke) in the top-right panel and backend with group + read/write scopes, and ensure PATs can authenticate API access (webhook excluded).

<!-- Close Phase 4 after adding PAT usage guidance in user docs. docs/en/developer/plans/open-api-pat-design/task_plan.md open-api-pat-design -->
## Current Phase
Complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm new requirements (expiry range, read/write, webhook exclusion)
- [x] Locate existing panel + auth guard + controller layout
- [x] Update findings.md with new constraints
- **Status:** complete

### Phase 2: Backend Data & Auth
- [x] Add DB schema + migration for PAT storage
- [x] Implement PAT service (hashing, validation, expiry, revoke)
- [x] Extend AuthGuard to accept PAT and enforce scopes
- [x] Add scope group decorators to controllers
- [x] Implement users/me PAT endpoints + DTOs
- **Status:** complete

### Phase 3: Frontend UI & API
- [x] Add API client functions + types
- [x] Extend user panel Credentials tab with PAT section
- [x] Add creation modal (name, scopes, expiry) + token reveal
- [x] Add list display + revoke/edit actions
- [x] Update i18n copy
- **Status:** complete

### Phase 4: Tests & Docs
- [x] Add backend unit tests for PAT validation/scope guard
- [x] Add frontend tests for PAT panel render/flow
- [x] Update user-facing docs (features section)
- [x] Add PAT usage steps in user docs (create/copy/use token)
- **Status:** complete

### Phase 5: Delivery
- [x] Verify plan/progress files updated
- [x] Update changelog entry for this session
- [x] Provide completion notes to user
- **Status:** complete

## Key Questions
1. What scope group keys will we expose (account, repos, tasks, events, system) and how map to controllers?
2. What token format and hash scheme will we use for PATs?
3. How should expiry be represented (days from now vs absolute date) in API?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Group scopes by module families (account/repos/tasks/events/system) | Meets group-based requirement without per-endpoint mapping |
| PAT tokens use a prefixed random string with SHA-256 hash storage | Avoids storing secrets while enabling fast lookup |
| Scope enforcement uses read/write level inferred from HTTP method | Keeps UX simple while enforcing secondary permission |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| backend/src/middlewares/auth.ts not found | 1 | Searched auth files under backend/src/modules/auth via rg |

## Notes
- Re-read this plan before major decisions
- Log ALL errors - they help avoid repetition

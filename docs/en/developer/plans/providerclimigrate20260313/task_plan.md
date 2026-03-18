# Task Plan: Migrate ClaudeCodeUI provider credential management into HookCode

## Session Metadata
- **Session Hash:** providerclimigrate20260313
- **Created:** 2026-03-13

## Goal
Replace HookCode's provider credential management and invocation flow with the ClaudeCodeUI model for Claude Code, Codex, and Gemini, while keeping HookCode's user/repo/robot override layers and making execution local-auth-first across all entrypoints.

## Current Phase
Phase 5 (complete)

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm migration scope with the user
- [x] Inspect HookCode and ClaudeCodeUI provider/auth implementations
- [x] Record the execution, UI, and credential-layer constraints
- **Status:** complete

### Phase 2: Backend Provider Runtime Refactor
- [ ] Add local provider auth-status detection aligned with ClaudeCodeUI
- [ ] Introduce a unified credential resolver for local/robot/repo/user precedence
- [ ] Expose backend APIs for provider status, resolution summary, and model listing
- **Status:** complete

### Phase 3: Execution Path Migration
- [ ] Replace task/chat credential selection with the unified resolver
- [ ] Route all Claude Code, Codex, and Gemini runs through the new provider runtime layer
- [ ] Persist provider-source diagnostics in logs/results for debugging
- **Status:** complete

### Phase 4: Frontend Provider Management Migration
- [ ] Rework the settings page to use ClaudeCodeUI-style provider status and actions
- [ ] Keep HookCode's settings shell while surfacing user/repo/robot advanced overrides
- [ ] Update frontend API clients, types, and i18n strings to match the new backend contracts
- **Status:** complete

### Phase 5: Verification, Docs, and Delivery
- [x] Run targeted backend/frontend tests and package builds
- [x] Update progress, findings, and changelog entries
- [x] Review user-facing docs impacted by the new provider flow
- **Status:** complete

## Key Questions
1. Which ClaudeCodeUI behaviors are the true source of truth for local auth detection and invocation? → `server/routes/cli-auth.js`, `server/claude-sdk.js`, `server/openai-codex.js`, and `server/gemini-cli.js`.
2. How should HookCode preserve layered credentials while still feeling like ClaudeCodeUI? → Local machine auth becomes the primary path, and HookCode's stored credentials become explicit advanced overrides.
3. Which execution paths must use the unified resolver? → Manual chat, repo robots, worker-driven task execution, and model-list probing.

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Keep only `claude_code`, `codex`, and `gemini_cli` in scope | The user explicitly excluded `cursor` from the migration target. |
| Preserve user/repo/robot layers behind a ClaudeCodeUI-style management flow | The user wants full layer retention while modernizing the behavior and UI. |
| Use local-auth-first resolution plus robot-configured stored-source fallback | This keeps ClaudeCodeUI's local-first behavior while still honoring HookCode's robot/repo/user layer choices. |
| Keep HookCode's settings page shell | The user prefers migration inside the existing HookCode page structure. |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` reported `docs.json missing navigation.languages[]` during session setup | 1 | Session files were still created successfully; continue implementation and revisit docs navigation during the delivery phase. |

## Notes
- Re-read this plan before changing backend execution resolution or frontend provider contracts.
- Every changed code area must include an English inline traceability comment with `docs/en/developer/plans/providerclimigrate20260313/task_plan.md providerclimigrate20260313`.
- Record all validation commands and failures in `progress.md`.

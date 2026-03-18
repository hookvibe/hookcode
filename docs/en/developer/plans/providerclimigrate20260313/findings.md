# Findings & Decisions: Migrate ClaudeCodeUI provider credential management into HookCode

## Session Metadata
- **Session Hash:** providerclimigrate20260313
- **Created:** 2026-03-13

## Requirements
- Migrate provider credential management and invocation behavior from ClaudeCodeUI into HookCode.
- Cover Claude Code, Codex, and Gemini across both backend and frontend.
- Cover all execution entrypoints, including manual chat and repo robot / worker execution.
- Do not prioritize backward compatibility in HookCode's current provider flow.
- Preserve HookCode's user/repo/robot credential layers.
- Use local-machine credentials as the highest-priority source, while preserving robot-configured robot/repo/user fallback behavior.
- Keep HookCode's current settings-page shell rather than introducing a separate ClaudeCodeUI page.

## Discovery Log
### ClaudeCodeUI
- `server/routes/cli-auth.js` is the canonical source for local auth detection.
- Claude auth detection prefers `ANTHROPIC_API_KEY`, then `~/.claude/.credentials.json`.
- Codex auth detection reads `~/.codex/config.toml` and falls back to `OPENAI_API_KEY`.
- Gemini auth detection checks environment keys and Gemini CLI configuration.
- `server/claude-sdk.js`, `server/openai-codex.js`, and `server/gemini-cli.js` define the runtime invocation patterns that the HookCode migration should mirror.
- ClaudeCodeUI's frontend uses provider status cards and login/config actions rather than database-first credential editing.

### HookCode
- Backend execution currently resolves provider credentials inline in `backend/src/agent/agent.ts`.
- HookCode already stores user-scoped, repo-scoped, and robot-scoped credential data, plus provider-specific robot config.
- HookCode already has user settings UIs and DTOs for stored provider credentials and model listing.
- Current provider model discovery already supports remote fetch + fallback, but it is not tied to a unified execution resolver.
- Repo robots persist provider selection and provider config, so execution migration must update both creation/update semantics and runtime resolution.

## Implementation Constraints
- Backend changes under `backend/` require frontend consumers in `frontend/` to stay in sync.
- Frontend text must remain internationalized and theme-safe.
- Backend provider APIs should keep secrets server-side and only return redacted summaries.
- Session documentation under `docs/en/developer/plans/providerclimigrate20260313/` is the source of truth for the work.

## Planned Architecture
- Add a unified provider runtime module in HookCode that owns:
  - local auth detection
  - credential resolution summary
  - final execution credential materialization
  - provider-specific model discovery input normalization
- Refactor `agent.ts` to consume the unified resolver instead of manually branching on provider-specific layer logic.
- Extend the settings experience so the default path is ClaudeCodeUI-like provider status management, with advanced override forms for user/repo/robot storage.
- Reuse existing provider executors where they already map well to ClaudeCodeUI's runtime style, but move the resolution logic out of the task runner.

## Open Items
- Determine the minimum set of new backend routes versus whether selected existing credential routes should be extended in place.
- Decide which repo/robot screens need resolution-summary badges so operators can see the actual source before execution.
- Verify whether current worker execution nodes have consistent access to local CLI configuration files in all deployment modes.

## Implementation Outcome
- Added a unified provider credential resolver for Codex, Claude Code, and Gemini.
- Added a new account-scoped runtime-status endpoint: `GET /api/users/me/model-providers/status`.
- Switched account and repo model-list probing to local-first credential resolution when no explicit inline/profile override is supplied.
- Updated task execution to resolve credentials once and reuse the same decision across provider runners.
- Updated the user settings page to surface ClaudeCodeUI-style local runtime status cards while keeping stored profiles as advanced overrides.

## Follow-up Hardening (2026-03-13)
- Repo-scoped model discovery now passes an explicit default stored source into the resolver so repo model lists start from repo credentials before falling back to user credentials.
- Claude Code and Gemini provider configs now clear `sandbox_workspace_write.network_access` whenever the sandbox is not `workspace-write`, and execution clamps the same rule server-side.
- Codex reasoning compatibility now handles gateways that reject `xhigh` / unsupported reasoning-effort values by downgrading `xhigh -> high -> medium` before falling back to removing the reasoning parameter entirely.
- Repo robot editor defaults now align the Codex default model with the backend (`gpt-5.1-codex-max`) and clear stale read-only network-access flags in form state.

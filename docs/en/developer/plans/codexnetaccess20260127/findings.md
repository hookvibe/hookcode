# Findings

## Summary
- User wants networkAccessEnabled removed from robot config binding in codex provider, and default to true.

## Details
- Target file mentioned by user: backend/src/modelProviders/codex.ts.
- Compatibility is not required; remove config entirely.

## Discovery Log
- networkAccessEnabled is set from params.networkAccess in backend/src/modelProviders/codex.ts.
- Related networkAccess flags flow through backend/src/agent/agent.ts and unit tests (codexProviderConfig.test.ts, codexExec.test.ts).
- Codex config currently includes sandbox_workspace_write.network_access with default false, normalized in codex.ts.
- agent.ts derives networkAccess from codexCfg.sandbox_workspace_write.network_access for Codex provider.
- Frontend RepoDetailPage and api.ts include codex sandbox_workspace_write.network_access in types, defaults, and payloads.
- Robot form renders a network access switch bound to modelProviderConfig.sandbox_workspace_write.network_access for all providers.
- Unit tests codexExec.test.ts and codexProviderConfig.test.ts assert networkAccess options and codex config defaults; they must be updated when removing network_access.
- robotPermission and repo-robot services only use codex sandbox/model fields; no other backend logic depends on codex network_access.
- Example codex exec text files include sandbox_workspace_write.network_access, but editing them would require English-only output.
- Codex public config type in frontend api.ts includes sandbox_workspace_write.network_access and must be updated to match backend removal.
- RepoDetailPage builds default modelProviderConfig and resets defaults on provider change, currently including sandbox_workspace_write.network_access for codex.
- No explicit noUnusedLocals flag found in repo search, but unused helpers may still be flagged by lint/test configs.
- After changes, codex backend only references networkAccessEnabled in SDK options; other providers still use sandbox_workspace_write.network_access.
- Codex provider config now omits sandbox_workspace_write, and buildCodexSdkThreadOptions hardcodes networkAccessEnabled: true.
- Backend test script runs Jest via pnpm -C backend test (pretest runs Prisma generate).
- Change log updates are required in docs/en/change-log/0.0.0.md for delivery.
- Modified files span codex backend, agent execution, frontend robot config UI, and related unit tests.

# Findings & Decisions: Robot Dry Run and Prompt Playground

## Session Metadata
- **Session Hash:** robot-dryrun-playground-20260313
- **Created:** 2026-03-13

## Requirements
- Add a robot-level playground entry from the repo robot editor.
- Show the fully rendered prompt for the current robot draft instead of only the raw template.
- Show provider/model/credential resolution so users can verify the final execution target.
- Support a side-effect-free dry run that never writes to the real repository and never posts comments or PRs/MRs.
- Keep frontend/backend i18n and audit logging aligned with existing repo features.

## Research Findings
- `backend/src/agent/promptBuilder.ts` already renders the final robot prompt and supports repo/robot/task/comment/issue/merge-request variables.
- `backend/src/modelProviders/providerCredentialResolver.ts` already resolves local/robot/repo/user model credentials and returns a safe summary that fits the roadmap response.
- `backend/src/providerRouting/providerRouting.service.ts` already builds the primary/fallback provider routing plan and exposes credential previews per attempt.
- `backend/src/modules/repositories/repositories.controller.ts` already hosts robot-scoped APIs and injects both `SkillsService` and `LogWriterService`, which makes it the right API surface for the playground MVP.
- `frontend/src/pages/RepoDetailPage.tsx` already owns the unsaved robot form draft, so the playground can preview current edits without forcing a save.
- The saved robot config cannot be re-normalized from an empty draft merge because that would silently drop routing/failover settings during dry-run previews.
- The repo's Mintlify workflow now expects `npx mintlify validate` as the verification entry point; the legacy `mintlify build` command is no longer available in the current CLI.
- The docs session files are created by the shared `file-context-planning` skill under `.codex`, `.claude`, and `.gemini`, so fixing repo docs behavior alone was not enough; the generator scripts and tests needed to be corrected too.
- A broader skill audit showed the remaining high-confidence problems were stale `.gemini` `SKILL.md` files rather than broken bundled scripts; sampled `ui-ux-pro-max` CSV diffs were newline-format drift, not semantic data drift.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Implement the MVP as `POST /repos/:id/robots/:robotId/dry-run`. | The roadmap centers on repo robots, and the endpoint can accept unsaved draft overrides from the editor. |
| Also add `POST /repos/:id/robots/dry-run` for unsaved/new robot drafts. | New robots need prompt/provider previews before a persistent robot record exists. |
| Use synthetic task/payload builders for `manual_chat`, `issue`, `merge_request`, `push`, and `custom` simulations. | This keeps prompt rendering deterministic and avoids creating real tasks. |
| Execute provider dry runs in an isolated temporary workspace. | The model runtime remains close to the real execution path while preserving the "never write the real repo" boundary. |
| Add a dedicated frontend playground dialog instead of expanding the existing robot modal body further. | `RepoDetailPage.tsx` is already very large; a separate component keeps the new UI maintainable. |
| Add payload-based issue fallback support to `promptBuilder`. | Dry-run inputs should render issue title/body even when no provider API client is available. |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` created the session files but failed during docs navigation sync with `docs.json missing navigation.languages[]`. | Fixed later by migrating `docs/docs.json` to `navigation.languages[].tabs[]` and re-enabling the docs sync precondition. |
| Mintlify docs validation initially failed because the docs package still used `mintlify build`, `docs/logo` assets were missing, and many existing docs files still used HTML comments. | Updated the docs build script to `npx mintlify validate`, restored the logo assets, converted the remaining whole-line HTML comments to MDX-safe `{/* ... */}` syntax, synced plan navigation, and verified both docs validation commands pass. |
| The follow-up audit showed the shared `file-context-planning` skill still assumed the newer grouped plan output in code but the tests still asserted the older flat page list, and the Gemini copy still referenced `.codex/...` helper paths. | Updated the sync script to migrate legacy `navigation.tabs` layouts, refreshed the tests to assert grouped Mintlify plan pages, made init-session sync failures non-fatal, and fixed the Gemini/Claude skill copy drift. |
| A wider audit across `.codex`, `.claude`, and `.gemini` showed `hookcode-pat-api-debug`, `hookcode-preview-highlight`, `ui-ux-pro-max`, and `file-context-planning` had stale Gemini `SKILL.md` guidance even though their bundled scripts and sampled data files were current. | Rewrote those Gemini `SKILL.md` files so their documented workflows, paths, and capabilities match the current scripts; sampled `ui-ux-pro-max` data file diffs were confirmed to be newline-only. |

## Resources
- `ROADMAP_02_ROBOT_DRY_RUN_AND_PLAYGROUND.md`
- `backend/src/agent/promptBuilder.ts`
- `backend/src/modelProviders/providerCredentialResolver.ts`
- `backend/src/providerRouting/providerRouting.service.ts`
- `backend/src/modules/repositories/repositories.controller.ts`
- `frontend/src/pages/RepoDetailPage.tsx`
- `frontend/src/api/repos.ts`
- `frontend/src/i18n/messages/en-US/repos.ts`
- `frontend/src/i18n/messages/zh-CN/repos.ts`

## Visual/Browser Findings
- None.

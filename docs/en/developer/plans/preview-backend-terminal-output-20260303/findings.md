<!-- Capture feasibility findings and design constraints for preview terminal-mode planning. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 -->
# Findings & Decisions: Preview terminal mode via `.hookcode.yml` flag

## Session Metadata
- **Session Hash:** preview-backend-terminal-output-20260303
- **Created:** 2026-03-03

## Requirements
- Add a special flag in `.hookcode.yml` for preview instances so backend previews do not need WebView iframe rendering.
- For flagged instances, render terminal/log output in the preview area.
- Keep frontend WebView behavior for normal (frontend) preview instances.

## Implementation Findings
- Implemented `preview.instances[].display` in config schema and shared types with enum `webview | terminal`.
- Added backward-compatible default: when `display` is omitted, backend emits `webview`.
- Extended backend preview status/admin/repo contracts to return display mode for each instance.
- Updated `TaskGroupChatPage` to:
  - keep iframe/browser controls for `webview`
  - render inline terminal logs for `terminal`
  - reuse the existing preview logs SSE stream for both modal and inline terminal panel.
- Updated frontend/backend tests and validated through targeted tests + full `pnpm test` + backend/frontend builds.

## Research Findings
- `HookcodeConfigService` strictly validates `preview.instances[]` fields; current schema only allows `name/command/workdir/env/readyPattern`.
  - Any new flag must be added to Zod schema and shared types first, otherwise config parse will fail.
- Backend already has preview log streaming capability:
  - Endpoint: `GET /api/task-groups/:id/preview/:instanceName/logs` (SSE, `init` + `log` events).
  - Runtime log source is already connected to preview process stdout/stderr/system lines.
- Frontend `TaskGroupChatPage` currently:
  - Renders preview instances primarily as iframe WebView when status is running.
  - Has an existing preview log modal fed by the same SSE endpoint.
  - Supports multi-instance tabs, which is a good base for mixed display modes.
- Current preview status DTO/type does not include a display/render mode field per instance.

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Plan a per-instance display flag instead of global preview-level switch | Supports mixed repositories with both frontend (webview) and backend (terminal) instances in one task group |
| Reuse existing preview SSE logs for terminal mode | Avoids introducing another transport path and keeps backend scope minimal |
| Make absent flag default to `webview` | Maintains backward compatibility for existing `.hookcode.yml` files |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| `init-session.sh` reported `docs.json missing navigation.languages[]` | Treated as non-blocking; planning files were created and maintained manually |

## Resources
- `backend/src/services/hookcodeConfigService.ts`
- `backend/src/types/dependency.ts`
- `backend/src/modules/tasks/preview.types.ts`
- `backend/src/modules/tasks/task-group-preview.controller.ts`
- `frontend/src/api/types/preview.ts`
- `frontend/src/pages/TaskGroupChatPage.tsx`

## Visual/Browser Findings
- Terminal-mode instances now hide iframe navigation controls and show inline log stream with status/count metadata.

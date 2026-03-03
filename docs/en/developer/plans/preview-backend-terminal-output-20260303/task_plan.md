<!-- Plan the preview terminal-mode feature scope, phases, and guardrails before implementation. docs/en/developer/plans/preview-backend-terminal-output-20260303/task_plan.md preview-backend-terminal-output-20260303 -->
# Task Plan: Preview terminal mode via `.hookcode.yml` flag

## Session Metadata
- **Session Hash:** preview-backend-terminal-output-20260303
- **Created:** 2026-03-03

## Goal
Add a `.hookcode.yml` preview instance flag to mark instances that should render as terminal output instead of WebView iframe, and wire backend/frontend contracts so backend-like instances can be viewed and managed as live logs in the preview panel.

## Current Phase
Phase 5 (complete)

## Phases
### Phase 1: Requirements & Discovery
- [x] Confirm user intent and expected UX for backend preview instances
- [x] Locate config parsing, preview runtime, and frontend preview rendering entry points
- [x] Record feasibility and constraints in findings
- **Status:** complete

### Phase 2: API & Config Design
- [x] Define `.hookcode.yml` flag name and enum shape (instance-level)
- [x] Define backend DTO/type changes for exposing display mode
- [x] Define frontend rendering contract (webview vs terminal)
- **Status:** complete

### Phase 3: Backend Implementation
- [x] Extend config schema/type validation for new preview display mode flag
- [x] Extend preview status snapshot/DTO so frontend receives mode per instance
- [x] Add/adjust backend tests for config parsing + status payload
- **Status:** complete

### Phase 4: Frontend Implementation
- [x] Add display-mode type support in frontend preview API contracts
- [x] Render terminal-mode instances in preview panel without iframe
- [x] Reuse/adjust preview log streaming UI for terminal-mode live output
- [x] Add/adjust frontend tests
- **Status:** complete

### Phase 5: Verification & Delivery
- [x] Run targeted tests for changed backend/frontend modules
- [x] Run full test suite after adding/modifying tests
- [x] Update session docs + changelog and prepare delivery notes
- **Status:** complete

## Key Questions
1. Should the display flag be per-instance (recommended) or global for all preview instances?
2. What is the minimal backward-compatible schema (`default: webview`) to avoid breaking existing `.hookcode.yml` files?
3. In terminal mode, should the right panel keep current toolbar controls (status/start-stop/open-link) and which controls become hidden/disabled?
4. Should terminal mode rely on existing preview logs SSE (`/preview/:instance/logs`) or introduce a separate stream endpoint?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Use a per-instance display mode flag in `preview.instances[]` (enum `webview | terminal`) | Repositories can run mixed workloads (frontend + backend) in one task group without forcing a single render mode |
| Reuse existing preview log stream for terminal rendering | Current SSE log endpoint already exists and reduces backend scope/risk |
| Keep default mode as `webview` when flag is absent | Preserve compatibility for all existing repositories/configurations |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| `init-session.sh` returned `docs.json missing navigation.languages[]` | 1 | Treated as non-blocking; session files were created and continued with manual updates |

## Notes
- Re-read this plan before finalizing flag naming and API shapes.
- Avoid changing preview process lifecycle logic unless required for terminal-mode correctness.
- Keep backend security boundaries unchanged (frontend rendering mode is not an auth boundary).

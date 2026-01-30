# Task Plan: backend mcp
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. z4xn4m8yue7jxh9jv1p2 */}

## Session Metadata
- **Session Hash:** z4xn4m8yue7jxh9jv1p2
- **Created:** 2026-01-30

## Goal
Provide and implement a user-side HTTP MCP server under `.codex` that exposes selected backend APIs (tasks/task-groups/webhook) with client-supplied auth token support.

## Current Phase
Phase 4

## Phases

### Phase 1: Requirements & Discovery
- [x] Confirm backend stack, API style, and existing API docs
- [x] Clarify MCP transport and auth injection expectations
- [x] Confirm exact endpoint scope and mapping expectations
- [x] Document findings in findings.md
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define MCP server approach (adapter vs direct integration)
- [x] Map API endpoints to MCP tools/resources
- [x] Document decisions with rationale
- **Status:** complete

### Phase 3: Implementation
- [x] Implement MCP server wrapper in backend + client helper under `.codex`
- [x] Add auth injection and config handling
- [x] Add tests for tool mapping and auth behavior
- **Status:** complete

### Phase 4: Testing & Verification
- [ ] Run tests and verify MCP server behavior
- [ ] Document test results in progress.md
- [ ] Fix issues found
- **Status:** in_progress

### Phase 5: Delivery
- [ ] Review touched files and docs
- [ ] Ensure deliverables are complete
- [ ] Deliver summary + next steps
- **Status:** pending

## Key Questions
1. Which exact endpoints should map to MCP tools (tasks/task-groups/webhook subset)?
2. Which MCP HTTP transport flavor do you expect (SSE vs JSON-RPC over HTTP)?
3. Should MCP server call backend via base URL env var, or use local in-process calls?

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| Build MCP as a separate HTTP server entrypoint under `backend/src/mcp` | Keeps backend core unchanged while meeting “server in backend” requirement and allowing independent start/stop |
| Use Streamable HTTP transport with optional JSON-only mode | Aligns with MCP spec and supports simple HTTP clients |
| Forward auth token from MCP request headers to backend API | Lets users supply token in MCP client config without storing secrets server-side |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| pnpm add @modelcontextprotocol/sdk timed out | 1 | Re-ran with longer timeout; install succeeded |

## Notes
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

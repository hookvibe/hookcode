# Findings & Decisions: Task group log loading refactor - performance and UX improvements
{/* Link discoveries to code changes via this session hash. taskgroup-logs-refactor-20260306 */}

## Session Metadata
- **Session Hash:** taskgroup-logs-refactor-20260306
- **Created:** 2026-03-06

## Requirements
- Fix multiple performance bottlenecks: slow DB queries (>500ms), frontend rendering lag, network latency, large payloads
- Improve error handling: show error state for failed tasks but allow manual scroll to continue loading other tasks
- Add comprehensive loading UX: skeleton loaders, smooth transitions, progress indicators

## Research Findings
- Current architecture uses `task_logs` table with `(taskId, seq)` indexes for cursor-based pagination
- Backend provides `/tasks/:id/logs` REST endpoint with `before` parameter for paging
- Frontend uses SSE for real-time logs + HTTP fallback (`bootstrapHistoryFromHttp`) when SSE fails
- TaskGroupChatPage implements "chained loading" - loads current task logs first, then reveals previous tasks sequentially
- `historyExhausted` flag prevents loading next task until current task's log history is fully loaded
- When SSE fails before `init` event, `bootstrapHistoryFromHttp` is called but UX shows no loading state
- No virtual scrolling - all log lines render synchronously (performance issue for 1000+ lines)
- No skeleton loaders during initial log load (connecting state)
- No loading indicators during "load earlier" pagination
- No CSS animations for new content appearance
- Scroll event handlers in TaskGroupChatPage are not debounced
- TaskLogViewer components are mounted for all visible tasks (not lazy-loaded)
- No performance logging to measure actual bottlenecks
- Agent writes logs one-by-one to DB (no batching)

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| Add performance logging to TaskLogsService | Measure actual query times to validate optimization impact |
| Batch agent log writes (buffer 10 lines, flush every 500ms) | Reduce DB round trips from N to N/10 without significant delay |
| Add virtual scrolling with react-window | Handle 1000+ log lines without rendering all DOM nodes |
| Add LogViewerSkeleton during connecting state | Show loading progress and prevent layout shift |
| Add "Loading earlier logs..." spinner in header | Clear feedback during pagination |
| Add CSS fade-in animations for new logs | Smooth content appearance (respect prefers-reduced-motion) |
| Debounce scroll handler (100ms) | Reduce event overhead in TaskGroupChatPage |
| Use IntersectionObserver for "load more" trigger | More efficient than scroll event polling |
| Add manual "Load previous task" button on error | Allow user to skip failed tasks and continue |
| Improve SSE reconnection with exponential backoff | Reduce server load during network issues |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| No clear performance data | Add timing logs to identify bottlenecks |
| Chained loading deadlocks on SSE failure | Already has HTTP fallback, need better UX |
| No loading indicators | Add skeletons and spinners |
| Render lag with long logs | Add virtual scrolling |

## Resources
- `backend/src/modules/tasks/task-logs.service.ts` - Log pagination service
- `backend/src/agent/agent.ts` - Agent log writes
- `frontend/src/components/TaskLogViewer.tsx` - Log viewer component
- `frontend/src/pages/TaskGroupChatPage.tsx` - Task group chat with chained loading
- `frontend/src/styles/log-viewer.css` - Log viewer styles
- `frontend/src/components/skeletons/LogViewerSkeleton.tsx` - Existing skeleton component

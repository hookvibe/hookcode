# Task Plan: 队列任务等待原因提示与重试
<!-- 
  WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk."
  WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh.
  WHEN: Create this FIRST, before starting any work. Update after each phase completes.
-->

<!-- Track code changes with this session hash for traceability. f3a9c2d8e1b7f4a0c6d1 -->

## Session Metadata
<!-- 
  WHAT: Stable identifiers for traceability (code comments ↔ plan folder).
  WHY: Makes it easy to find the plan that explains a change.
-->
- **Session Hash:** f3a9c2d8e1b7f4a0c6d1
- **Created:** 2026-01-19

## Goal
<!-- 
  WHAT: One clear sentence describing what you're trying to achieve.
  WHY: This is your north star. Re-reading this keeps you focused on the end state.
  EXAMPLE: "Create a Python CLI todo app with add, list, and delete functionality."
-->
<!-- Clarify the user-visible end state for queued tasks and retry UX. f3a9c2d8e1b7f4a0c6d1 -->
在任务列表与任务详情中展示“任务长期处于队列中”的可解释原因，并提供可安全重试的按钮（含后端原因诊断与重试接口、前端展示与交互）。

## Current Phase
<!-- 
  WHAT: Which phase you're currently working on (e.g., "Phase 1", "Phase 3").
  WHY: Quick reference for where you are in the task. Update this as you progress.
-->
Complete

## Phases
<!-- 
  WHAT: Break your task into 3-7 logical phases. Each phase should be completable.
  WHY: Breaking work into phases prevents overwhelm and makes progress visible.
  WHEN: Update status after completing each phase: pending → in_progress → complete
-->

### Phase 1: Requirements & Discovery
<!-- 
  WHAT: Understand what needs to be done and gather initial information.
  WHY: Starting without understanding leads to wasted effort. This phase prevents that.
-->
- [x] Understand user intent
- [x] Identify constraints and requirements
- [x] Document findings in findings.md
- **Status:** complete
<!-- 
  STATUS VALUES:
  - pending: Not started yet
  - in_progress: Currently working on this
  - complete: Finished this phase
-->

### Phase 2: Planning & Structure
<!-- 
  WHAT: Decide how you'll approach the problem and what structure you'll use.
  WHY: Good planning prevents rework. Document decisions so you remember why you chose them.
-->
- [x] Define technical approach
- [x] Decide API shape for queue diagnosis
- [x] Decide UI placement for queue reason + retry
- **Status:** complete

### Phase 3: Implementation
<!-- 
  WHAT: Actually build/create/write the solution.
  WHY: This is where the work happens. Break into smaller sub-tasks if needed.
-->
- [x] Execute the plan step by step
- [x] Implement backend queue diagnosis + types
- [x] Implement frontend queued hint + retry buttons
- [x] Test incrementally
- **Status:** complete

### Phase 4: Testing & Verification
<!-- 
  WHAT: Verify everything works and meets requirements.
  WHY: Catching issues early saves time. Document test results in progress.md.
-->
- [x] Verify all requirements met
- [x] Document test results in progress.md
- [x] Fix any issues found
- **Status:** complete

### Phase 5: Delivery
<!-- 
  WHAT: Final review and handoff to user.
  WHY: Ensures nothing is forgotten and deliverables are complete.
-->
- [x] Review all output files
- [x] Update changelog entry
- [x] Deliver to user
- **Status:** complete

## Key Questions
<!-- 
  WHAT: Important questions you need to answer during the task.
  WHY: These guide your research and decision-making. Answer them as you go.
  EXAMPLE: 
    1. Should tasks persist between sessions? (Yes - need file storage)
    2. What format for storing tasks? (JSON file)
-->
1. 任务“队列中/等待中”在后端的真实含义是什么（DB 状态 / 队列 job 状态 / worker lock）？
2. 任务长期卡在队列中的典型原因有哪些，哪些原因可以被稳定识别并返回给前端？
3. “重试”应当如何定义：重新入队、重新执行、还是创建新任务并关联旧任务（幂等/审计如何做）？
4. 重试按钮的可见/可点条件是什么（权限、状态、冷却时间、最大次数）？
5. 前端展示原因的最佳位置与文案格式是什么（列表、详情、tooltip、error code）？

## Decisions Made
<!-- 
  WHAT: Technical and design decisions you've made, with the reasoning behind them.
  WHY: You'll forget why you made choices. This table helps you remember and justify decisions.
  WHEN: Update whenever you make a significant choice (technology, approach, structure).
  EXAMPLE:
    | Use JSON for storage | Simple, human-readable, built-in Python support |
-->
| Decision | Rationale |
|----------|-----------|
| Add structured queue diagnosis on Task API | Frontend can render clear queued-state hints without hardcoding backend internals. |
| Reuse existing `POST /tasks/:id/retry` for queued retry | Avoid new endpoints; keep behavior consistent with existing retry UI for failed/processing tasks. |

## Errors Encountered
<!-- 
  WHAT: Every error you encounter, what attempt number it was, and how you resolved it.
  WHY: Logging errors prevents repeating the same mistakes. This is critical for learning.
  WHEN: Add immediately when an error occurs, even if you fix it quickly.
  EXAMPLE:
    | FileNotFoundError | 1 | Check if file exists, create empty list if not |
    | JSONDecodeError | 2 | Handle empty file case explicitly |
-->
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
<!-- 
  REMINDERS:
  - Update phase status as you progress: pending → in_progress → complete
  - Re-read this plan before major decisions (attention manipulation)
  - Log ALL errors - they help avoid repetition
  - Never repeat a failed action - mutate your approach instead
-->
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

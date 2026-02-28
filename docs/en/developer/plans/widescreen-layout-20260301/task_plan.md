# Task Plan: Fix sidebar pages wide-screen layout
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. widescreen-layout-20260301 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** widescreen-layout-20260301
- **Created:** 2026-03-01

## Goal
Fix sidebar pages (repo detail, settings, archive, skills) wide-screen layout — remove hard max-width caps that keep content left-aligned with large empty space on the right.

## Current Phase
Phase 4 — complete

## Phases

### Phase 1: Requirements & Discovery
- [x] Identify root cause: `.hc-repo-tab-content { max-width: 1100px }` with no centering
- [x] Map all affected CSS files: repo-detail-sidebar.css (1100px), settings-layout.css (900px), archive-sidebar.css (1100px), skills-sidebar.css (1100px)
- **Status:** complete

### Phase 2: Planning
- [x] Repo detail / archive / skills: remove hard max-width → `max-width: 100%`
- [x] Settings: widen from 900px → 1000px and add `margin: 0 auto` centering
- **Status:** complete

### Phase 3: Implementation
- [x] Edit all 4 CSS files with `multi_replace_string_in_file`
- **Status:** complete

### Phase 4: Testing & Verification
- [x] 149/149 frontend tests pass
- **Status:** complete

### Phase 5: Delivery
{/* WHAT: Final review and handoff to user. WHY: Ensures nothing is forgotten and deliverables are complete. */}
- [ ] Review all output files
- [ ] Ensure deliverables are complete
- [ ] Deliver to user
- **Status:** pending

## Key Questions
{/* WHAT: Important questions you need to answer during the task. WHY: These guide your research and decision-making. Answer them as you go. EXAMPLE: 1. Should tasks persist between sessions? (Yes - need file storage) 2. What format for storing tasks? (JSON file) */}
1. [Question to answer]
2. [Question to answer]

## Decisions Made
{/* WHAT: Technical and design decisions you've made, with the reasoning behind them. WHY: You'll forget why you made choices. This table helps you remember and justify decisions. WHEN: Update whenever you make a significant choice (technology, approach, structure). EXAMPLE: | Use JSON for storage | Simple, human-readable, built-in Python support | */}
| Decision | Rationale |
|----------|-----------|
|          |           |

## Errors Encountered
{/* WHAT: Every error you encounter, what attempt number it was, and how you resolved it. WHY: Logging errors prevents repeating the same mistakes. This is critical for learning. WHEN: Add immediately when an error occurs, even if you fix it quickly. EXAMPLE: | FileNotFoundError | 1 | Check if file exists, create empty list if not | | JSONDecodeError | 2 | Handle empty file case explicitly | */}
| Error | Attempt | Resolution |
|-------|---------|------------|
|       | 1       |            |

## Notes
{/* REMINDERS: - Update phase status as you progress: pending → in_progress → complete - Re-read this plan before major decisions (attention manipulation) - Log ALL errors - they help avoid repetition - Never repeat a failed action - mutate your approach instead */}
- Update phase status as you progress: pending → in_progress → complete
- Re-read this plan before major decisions (attention manipulation)
- Log ALL errors - they help avoid repetition

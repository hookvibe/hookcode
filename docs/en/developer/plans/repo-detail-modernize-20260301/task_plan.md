# Task Plan: Modernize repo detail page section display
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. repo-detail-modernize-20260301 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** repo-detail-modernize-20260301
- **Created:** 2026-03-01

## Goal
Modernize all tab section containers on the repo detail page from plain AntD `<Card>` wrappers to a custom glass-morphism `hc-section-block` design system with layered shadows, consistent spacing, and hover micro-interactions.

## Current Phase
Phase 5

## Phases

### Phase 1: Requirements & Discovery
- [x] Understand user intent — replace dated AntD Card-based sections with modern glass-morphism blocks
- [x] Identify all tab sections that use `<Card className="hc-card">`
- [x] Document findings
- **Status:** complete

### Phase 2: Planning & Structure
- [x] Define `hc-section-block` CSS component system
- [x] Plan tab-by-tab conversion order
- **Status:** complete

### Phase 3: Implementation
- [x] Add `hc-section-block` CSS to `repo-detail-layout.css` (~120 lines)
- [x] Modernize Summary strip (RepoDetailDashboardSummaryStrip) — done in prior conversation turn
- [x] Modernize Preview card in Overview tab — done in prior conversation turn
- [x] Modernize Basic tab
- [x] Modernize Credentials tab (repo provider + model provider)
- [x] Modernize Robots tab
- [x] Modernize Automation tab
- [x] Modernize Skills tab
- [x] Modernize Webhooks tab (webhook info + deliveries list)
- [x] Modernize Members tab (members table + invites)
- [x] Modernize Settings tab (API tokens + danger zone)
- [x] Remove unused `Descriptions` import
- **Status:** complete

### Phase 4: Testing & Verification
- [x] Frontend build passes (`pnpm --filter hookcode-frontend build` — 4.93s)
- **Status:** complete

### Phase 5: Delivery
- [x] Update changelog
- [x] Update progress.md
- **Status:** complete

## Key Questions
1. Should inner cards (credential profiles, token items) also use section-block? **Yes** — switched to `hc-section-block__item`.
2. Should danger zone get special treatment? **Yes** — added `hc-section-block--danger` variant with red border accent.
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
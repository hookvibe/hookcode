# Task Plan: Refactor repo detail page into sidebar sub-navigation tabs

- **Session Hash:** repo-detail-subnav-20260228
- **Created:** 2026-02-28

## Goal
When users open a repo detail page, replace the monolithic scrollable dashboard with a sidebar-driven sub-navigation. Each major section becomes a separate sub-page accessible via the left sidebar, giving each section full page space.

## Current Phase
Phase 5: Delivery

## Phases

### Phase 1: Discovery & Planning
- [x] Analyze current RepoDetailPage structure (3596 lines, all sections in one scroll)
- [x] Analyze ModernSidebar component (667 lines, global nav)
- [x] Analyze router structure (hash-based, #/repos/:id)
- [x] Identify all sections: overview, basic, branches, credentials, robots, automation, skills, preview, webhooks, members, danger, tokens
- **Status:** complete

### Phase 2: Architecture Design
- [x] Define 10 repo tabs: overview | basic | branches | credentials | robots | automation | skills | webhooks | members | settings
- [x] Route format: `#/repos/:id/:tab` (tab is optional, defaults to overview)
- [x] RepoDetailSidebar component with back navigation + repo name + tab nav items
- [x] AppShell hides global sidebar when on repo detail page
- **Status:** complete

### Phase 3: Implementation
- [x] Router: RepoTab type, REPO_TABS, repoTab on RouteState, parseRoute & buildRepoHash
- [x] i18n: Added tab labels (overview/skills/members/settings) + backToRepos in en-US & zh-CN
- [x] RepoDetailSidebar component created with icons, active state, navigation
- [x] CSS: repo-detail-sidebar.css with layout container + sidebar + tab content styles
- [x] AppShell: hideGlobalSidebar flag, pass repoTab to RepoDetailPage
- [x] RepoDetailPage: Replaced monolithic dashboard IIFE (1000+ lines) with tab-based conditional rendering
- [x] Cleanup: Removed dead sectionDomId/scrollToSection, replaced with navigateToTab
- **Status:** complete

### Phase 4: Testing & Verification
- [x] TypeScript compilation: no errors in changed files
- [x] Vite production build: passes (4926 modules, 4.73s)
- [x] Bundle size: 2528.30 KB (no increase)
- **Status:** complete

### Phase 5: Delivery
- [ ] Update change-log
- **Status:** in_progress

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
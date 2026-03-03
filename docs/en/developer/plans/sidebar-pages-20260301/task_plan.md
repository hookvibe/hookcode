# Task Plan: Convert ArchivePage and SkillsPage to sidebar sub-navigation
{/* WHAT: This is your roadmap for the entire task. Think of it as your "working memory on disk." WHY: After 50+ tool calls, your original goals can get forgotten. This file keeps them fresh. WHEN: Create this FIRST, before starting any work. Update after each phase completes. */}

{/* Track code changes with this session hash for traceability. sidebar-pages-20260301 */}

## Session Metadata
{/* WHAT: Stable identifiers for traceability (code comments ↔ plan folder). WHY: Makes it easy to find the plan that explains a change. */}
- **Session Hash:** sidebar-pages-20260301
- **Created:** 2026-03-01

## Goal
Convert ArchivePage and SkillsPage from global-sidebar pages to standalone sidebar sub-navigation layouts, matching the RepoDetailPage and UserSettingsPage pattern.

## Current Phase
Phase 3: Tests & docs

## Phases

### Phase 1: ArchivePage sidebar conversion — complete
- [x] Add `ArchiveTab` type and router support
- [x] Create `ArchiveSidebar` component  
- [x] Refactor ArchivePage to use sidebar layout
- [x] Add CSS + i18n keys
- [x] Hide global sidebar on archive page

### Phase 2: SkillsPage sidebar conversion — complete
- [x] Add `SkillsTab` type and router support
- [x] Create `SkillsSidebar` component
- [x] Refactor SkillsPage to use sidebar layout
- [x] Add CSS + i18n keys
- [x] Hide global sidebar on skills page

### Phase 3: Tests & docs — in_progress
- [ ] Update existing tests
- [x] Update changelog

## Key Questions
- Reuse existing sidebar CSS classes (hc-modern-sidebar, hc-sidebar-content, hc-nav-item)
- Follow same collapse/expand pattern with localStorage persistence

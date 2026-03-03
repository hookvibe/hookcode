# Task Plan: Modernize Frontend Visual Design System

{/* Track code changes with this session hash for traceability. ui-modernize-20260301 */}

## Session Metadata
- **Session Hash:** ui-modernize-20260301
- **Created:** 2026-03-01

## Goal
Modernize the entire HookCode frontend visual language from flat/dated gray to a polished, contemporary SaaS-grade UI with subtle brand accent, glass-morphism surfaces, improved shadows, and modern micro-interactions.

## Current Phase
Phase 1

## Phases

### Phase 1: Design Tokens Modernization (tokens.css)
- [ ] Replace monochrome accent with subtle indigo brand accent
- [ ] Add glass-morphism variables (backdrop-blur, semi-transparent surfaces)
- [ ] Refine shadow scale with more layered, modern shadows
- [ ] Add accent gradient variables
- [ ] Improve surface color hierarchy
- **Status:** in_progress

### Phase 2: Global Component CSS + AntD Overrides
- [ ] Modernize card glass-morphism (.hc-card, .hc-modern-card)
- [ ] Refine AntD overrides (tags, controls, buttons)
- [ ] Improve table styling
- [ ] Refine page layout spacing
- **Status:** pending

### Phase 3: Repo Detail Content + Sidebar Polish
- [ ] Modernize repo detail tab content CSS
- [ ] Improve section headers in tab content
- [ ] Polish sidebar with frosted backdrop
- **Status:** pending

### Phase 4: Build Validation + Delivery
- [ ] Run frontend build
- [ ] Update changelog
- **Status:** pending

## Key Questions
1. Keep dark/light theme parity? → Yes
2. Preserve existing CSS class names? → Yes
3. Accent color? → Indigo (#6366f1) as subtle brand tint

## Files to Modify
- `frontend/src/styles/tokens.css`
- `frontend/src/styles/cards.css`
- `frontend/src/styles/antd-overrides.css`
- `frontend/src/styles/repo-detail-layout.css`
- `frontend/src/styles/repo-detail-activity.css`
- `frontend/src/styles/repo-detail-sidebar.css`
- `frontend/src/styles/modern-sidebar.css`
- `frontend/src/styles/modern-page-nav.css`
- `frontend/src/styles/page-layout.css`
- `frontend/src/styles/base.css`
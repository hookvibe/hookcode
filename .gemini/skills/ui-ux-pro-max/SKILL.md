---
name: ui-ux-pro-max
description: UI/UX design intelligence for web and mobile. Provides design systems, color palettes, font pairings, and stack-specific best practices (React, Tailwind, shadcn, etc.). Use when designing, reviewing, or implementing UI components.
---

# UI/UX Pro Max (Gemini)

## Overview

A comprehensive design intelligence tool with 50+ styles and best practices for modern applications.

## Core Workflow

### 1. Generate Design System (Required)
Always start here to establish a consistent visual language.
```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "saas dashboard minimal dark" --design-system -p "MyProject" --persist
```

### 2. Domain-Specific Search
Refine details for specific UI aspects.
- **UX/Accessibility:** `--domain ux "accessibility buttons"`
- **Typography:** `--domain typography "modern professional"`
- **Charts:** `--domain chart "financial trend"`

### 3. Stack Guidelines
Get implementation tips for your technology.
- **Tailwind:** `--stack html-tailwind`
- **React:** `--stack react`
- **shadcn/ui:** `--stack shadcn`

## Design System Persistence
The `--persist` flag creates:
- `design-system/MASTER.md`: Global design rules.
- `design-system/pages/`: Page-specific overrides.

## Professional UI Checklist
- [ ] No emojis as icons (use SVGs).
- [ ] `cursor-pointer` on all interactive elements.
- [ ] Contrast ratio >= 4.5:1.
- [ ] Floating navbars have `top-4` etc. spacing.
- [ ] Smooth transitions (150-300ms).
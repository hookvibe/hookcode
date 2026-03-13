---
name: ui-ux-pro-max
description: "UI/UX design intelligence for Gemini. Use when designing, implementing, reviewing, or improving web and mobile interfaces. Includes searchable guidance for styles, colors, typography, UX rules, charts, and stack-specific implementation patterns."
---

# UI/UX Pro Max (Gemini)

Comprehensive design guidance for web and mobile applications backed by searchable CSV datasets and stack-specific implementation notes.

## When to Apply

Use this skill when:
- designing new UI components or pages
- choosing color palettes and typography
- reviewing code for UX or accessibility issues
- building landing pages, dashboards, SaaS apps, or mobile interfaces
- generating or refining a reusable design system

## Default Workflow

### 1. Start with a design system

Always begin with `--design-system` so you get a coherent visual direction instead of disconnected tips.

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<product type> <industry> <keywords>" --design-system -p "Project Name"
```

Example:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service elegant" --design-system -p "Serenity Spa"
```

### 2. Persist the design system when work spans multiple pages

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:
- `design-system/MASTER.md`
- `design-system/pages/`

For page-specific overrides:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

### 3. Run focused domain searches as needed

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

Common domains:
- `product`
- `style`
- `typography`
- `color`
- `landing`
- `chart`
- `ux`
- `react`
- `web`
- `prompt`

Examples:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "glassmorphism dark" --domain style
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "elegant luxury serif" --domain typography
```

### 4. Get stack-specific guidance

If the user does not specify a stack, default to `html-tailwind`.

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack html-tailwind
```

Available stacks include:
- `html-tailwind`
- `react`
- `nextjs`
- `vue`
- `svelte`
- `swiftui`
- `react-native`
- `flutter`
- `shadcn`
- `jetpack-compose`

## Practical Guidance

### Accessibility and interaction first

Prioritize:
- contrast
- visible focus states
- keyboard navigation
- 44x44 minimum touch targets
- clear error feedback

### Professional UI hygiene

- Use SVG icons instead of emojis.
- Add `cursor-pointer` to interactive cards and controls.
- Prefer stable hover states; avoid layout-shifting transforms.
- Keep transitions in the 150-300ms range.
- Reserve space for async content to reduce layout jump.
- Ensure no horizontal scroll on mobile.

### Layout defaults

- floating elements should have breathing room from the viewport edge
- text should keep readable line length
- light mode contrast must stay strong enough for body copy
- fixed navbars should not cover content

## Example End-to-End Flow

For a request like "design a professional skincare landing page":

1. Generate the design system:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service elegant" --design-system -p "Serenity Spa"
```

2. Pull UX rules if needed:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "animation accessibility" --domain ux
```

3. Pull stack guidance:

```bash
python3 .gemini/skills/ui-ux-pro-max/scripts/search.py "layout responsive form" --stack html-tailwind
```

Then synthesize the design system, the domain guidance, and the stack rules into the final UI.

## Pre-Delivery Checklist

- [ ] No emojis used as icons
- [ ] Contrast is sufficient in both light and dark contexts
- [ ] Interactive elements have pointer and visible feedback states
- [ ] Focus states are visible
- [ ] Layout works at mobile and desktop widths
- [ ] No horizontal overflow on mobile
- [ ] Motion respects reduced-motion preferences where relevant

## Resources

- `scripts/search.py`
- `scripts/core.py`
- `scripts/design_system.py`
- `data/`

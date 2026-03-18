---
name: hookcode-preview-highlight
description: End-to-end workflow for HookCode preview DOM highlighting: check preview status, start or stop previews, install dependencies, send highlight commands, and verify bridge readiness through PAT-authenticated APIs.
tags:
  - preview
  - debugging
  - highlight
---

# Hookcode Preview Highlight (Gemini)

## Overview

This skill ships request scripts and protocol notes for the full preview highlight flow:
- check preview status
- start previews
- install preview dependencies when needed
- send highlight commands
- stop previews after debugging

It also documents selector matcher rules, tooltip bubble payloads, and `targetUrl` auto-navigation behavior.

## Capabilities

- Query preview status to discover instance names and availability before highlighting.
- Start preview instances or install dependencies when the dev server is missing.
- Send highlight commands with selector, mode, color, padding, and scroll options.
- Send optional bubble tooltips alongside highlights.
- Support selector matchers like `text:`, `attr:`, `data:`, `aria:`, `role:`, and `testid:`.
- Auto-navigate previews when `targetUrl` is supplied.
- Verify bridge readiness through `subscribers` counts and bridge error responses.
- Stop previews after debugging to free ports and resources.

## Quick Start

1. Copy `.env.example` to `.env` inside `.gemini/skills/hookcode-preview-highlight/`.
2. Set `HOOKCODE_API_BASE_URL`, `HOOKCODE_PAT`, and `HOOKCODE_TASK_GROUP_ID`.
3. Fetch preview status:

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_status.mjs \
  --task-group <taskGroupId>
```

4. Send a basic highlight:

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
  --task-group <taskGroupId> \
  --instance app \
  --selector ".page-kicker"
```

5. Send a highlight with bubble tooltip:

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
  --task-group <taskGroupId> \
  --instance app \
  --selector ".page-kicker" \
  --target-url "/add" \
  --bubble-text "Update this headline" \
  --bubble-placement right \
  --bubble-theme dark
```

## Environment Variables

Set these in `.env` or override them via CLI flags:

| Variable | Purpose |
| --- | --- |
| `HOOKCODE_API_BASE_URL` | Base URL of the HookCode backend |
| `HOOKCODE_PAT` | PAT token for API authentication |
| `HOOKCODE_TASK_GROUP_ID` | Default task group id |
| `HOOKCODE_PREVIEW_INSTANCE` | Default preview instance name for highlight requests |

## Operations

### Preview status

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_status.mjs \
  --task-group <taskGroupId>
```

### Start preview

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_start.mjs \
  --task-group <taskGroupId>
```

### Install dependencies

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_dependencies_install.mjs \
  --task-group <taskGroupId>
```

### Send highlight command

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
  --task-group <taskGroupId> \
  --instance app \
  --selector ".page-kicker"
```

Key parameters:
- `selector` required; supports CSS selectors plus matcher rules like `text:Save` or `attr:data-testid=cta`
- `targetUrl` optional; supports route matching patterns like `:id`, `*`, `**`, hash/query wildcards, and `||` alternatives
- `padding`, `color`, `mode`, and `scrollIntoView` control the highlight appearance
- bubble options include `text`, `placement`, `align`, `offset`, `maxWidth`, `theme`, `background`, `textColor`, `borderColor`, `radius`, and `arrow`

### Stop preview

```bash
node .gemini/skills/hookcode-preview-highlight/scripts/preview_stop.mjs \
  --task-group <taskGroupId>
```

## Selector Matchers

When CSS selectors are not enough, use matcher rules such as:
- `text:Login`
- `attr:data-testid=submit`
- `data:testid=cta-main`
- `aria:label=Search`
- `role:button`
- `testid:cta-main`

## Target URL Matching

If a highlight command includes `targetUrl`, the preview can auto-navigate before highlighting.

Supported matching rules include:
- `:param` for a single path segment
- `*` for wildcard within a segment
- `**` for wildcard across segments
- query and hash wildcards
- `||` to provide alternatives

If navigation does not happen, check whether the preview toolbar auto-navigation lock is enabled.

## Bridge Requirements

- The preview app must include the preview bridge script.
- The bridge must answer the `hookcode:preview:ping` handshake.
- A response with `subscribers: 0` usually means the preview UI is not listening or the bridge is missing.

## Troubleshooting

- `preview_not_running`: start the preview first or verify the instance name.
- `selector_required` or `selector_not_found`: verify the element exists in the preview DOM.
- `bubble_text_required`: bubble payload was provided without valid text.
- `fetch failed`: verify `HOOKCODE_API_BASE_URL` and local network access.
- `subscribers: 0`: preview UI is not connected or the bridge is not installed.

## References

- `references/highlight-protocol.md`
- `scripts/preview_status.mjs`
- `scripts/preview_start.mjs`
- `scripts/preview_dependencies_install.mjs`
- `scripts/preview_highlight.mjs`
- `scripts/preview_stop.mjs`

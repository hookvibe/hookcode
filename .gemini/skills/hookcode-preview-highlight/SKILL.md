---
name: hookcode-preview-highlight
description: End-to-end workflow for HookCode preview DOM highlighting. Check status, start/stop previews, and send highlight commands with bubble tooltips via PAT-authenticated APIs. Supports CSS selectors and advanced matchers (text:, attr:, etc.).
---

# Hookcode Preview Highlight (Gemini)

## Overview

This skill allows Gemini to interact with the HookCode preview system. You can highlight DOM elements, show tooltips, and manage preview instances.

## Capabilities

- **Status Check:** See if a preview is running.
- **Preview Management:** Start/stop preview instances.
- **Highlighting:** Highlight elements using CSS selectors or text/attribute matchers.
- **Bubble Tooltips:** Show explanatory tooltips near highlighted elements.
- **Auto-navigation:** Navigate the preview to a specific `targetUrl`.

## Quick Start

1.  **Check Status:**
    ```bash
    node .gemini/skills/hookcode-preview-highlight/scripts/preview_status.mjs --task-group <id>
    ```
2.  **Start Preview:**
    ```bash
    node .gemini/skills/hookcode-preview-highlight/scripts/preview_start.mjs --task-group <id>
    ```
3.  **Highlight & Tooltip:**
    ```bash
    node .gemini/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
      --task-group <id> \
      --instance app \
      --selector ".btn-primary" \
      --bubble-text "This button triggers the submission"
    ```

## Selector Matchers

- `text:Login`
- `attr:data-testid=submit`
- `role:button`
- `testid:cta-main`

## Auto-navigation (targetUrl)

Include `--target-url "/dashboard"` to navigate the preview. Supports route patterns like `:id` and wildcards.

## Environment Variables

Ensure `.gemini/skills/hookcode-preview-highlight/.env` contains:
- `HOOKCODE_API_BASE_URL`
- `HOOKCODE_PAT`
- `HOOKCODE_TASK_GROUP_ID`
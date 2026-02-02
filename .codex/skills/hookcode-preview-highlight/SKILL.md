---
name: hookcode-preview-highlight
description: End-to-end workflow for HookCode preview DOM highlighting check/start/stop previews, install dependencies, send highlight commands, and verify preview bridge readiness via PAT-authenticated APIs. Use when debugging cross-origin preview iframes, validating bridge integration, or scripting highlight requests against task-group previews.
---

# Hookcode Preview Highlight


## Overview


This skill ships JS request scripts (with `.env` loading) and protocol notes for the complete preview highlight flow: check preview status, start previews, install dependencies if needed, send highlight commands, and stop previews after debugging. It also explains the bridge handshake required for cross-origin iframes so you can confirm whether highlight commands are actually reaching the preview DOM.

## Capabilities

- Query preview status to discover instance names and availability before highlighting.
- Start preview instances or install dependencies when the dev server is missing.
- Send highlight commands with selector/mode/color/padding/scroll options via the backend API.
- Send optional bubble tooltip payloads alongside highlights (text + placement + theme).
- Provide CLI flags that map one-to-one with highlight + bubble payload fields.
<!-- Expand highlight capability coverage to include bubble payloads. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->
- Verify bridge readiness by checking `subscribers` and bridge error responses.
- Stop previews after debugging to free ports and resources.

## Quick Start

1. Copy `.env.example` → `.env` inside this skill folder and fill in `HOOKCODE_API_BASE_URL`, `HOOKCODE_PAT`, and `HOOKCODE_TASK_GROUP_ID` (optional: `HOOKCODE_PREVIEW_INSTANCE`).
2. Fetch preview status to confirm instance names:

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_status.mjs \
  --task-group <taskGroupId>
```

3. Send a highlight command (highlight parameters must be passed via CLI flags):

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
  --task-group <taskGroupId> \
  --instance app \
  --selector ".page-kicker"
```

4. Send a highlight + bubble command:

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
  --task-group <taskGroupId> \
  --instance app \
  --selector ".page-kicker" \
  --bubble-text "Update this headline" \
  --bubble-placement right \
  --bubble-theme dark
```
<!-- Document bubble highlight example for CLI usage. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

## Environment Variables


Set these in `.env` (or override via CLI flags). Highlight-specific options are CLI-only.

| Variable | Purpose | Used by |
| --- | --- | --- |
| `HOOKCODE_API_BASE_URL` | Base URL of the HookCode backend (for example `http://127.0.0.1:4000`). | All scripts |
| `HOOKCODE_PAT` | PAT token for API authentication. | All scripts |
| `HOOKCODE_TASK_GROUP_ID` | Default task group id to target. | All scripts |
| `HOOKCODE_PREVIEW_INSTANCE` | Default preview instance name (for example `app`). | `preview_highlight.mjs` |

## Operations (HTTP)

### 1) Get preview status

**Endpoint**: `GET /api/task-groups/:id/preview/status`

**Purpose**: Confirm the preview is configured, see instance names, and check `running/starting` status before highlighting.

**Script**: `scripts/preview_status.mjs`

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_status.mjs \
  --task-group <taskGroupId>
```

### 2) Start preview

**Endpoint**: `POST /api/task-groups/:id/preview/start`

**Purpose**: Start all configured preview instances so the highlight API can reach a running dev server.

**Script**: `scripts/preview_start.mjs`

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_start.mjs \
  --task-group <taskGroupId>
```

### 3) Install preview dependencies

**Endpoint**: `POST /api/task-groups/:id/preview/dependencies/install`

**Purpose**: Run dependency installation without starting the dev server. Use this when highlight requests fail because the dev server never started.

**Script**: `scripts/preview_dependencies_install.mjs`

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_dependencies_install.mjs \
  --task-group <taskGroupId>
```

### 4) Send highlight command

**Endpoint**: `POST /api/task-groups/:id/preview/:instance/highlight`

**Purpose**: Forward a DOM highlight command to the preview iframe bridge.

**Script**: `scripts/preview_highlight.mjs`

**Parameters**:
- `selector` (required): CSS selector to highlight (max length 200).
- `padding` (optional): number of pixels around the element (0-64, default 4).
- `color` (optional): CSS color string for outline/glow (max length 40).
- `mode` (optional): `outline` or `mask` (default `outline`).
- `scrollIntoView` (optional): `true`/`false` (default `false`).
- `bubble` (optional): object for tooltip rendering near the highlight.
  - `text` (required when bubble provided): text content to display (1-280 chars).
  - `placement` (optional): `top` | `right` | `bottom` | `left` | `auto` (default `auto`).
  - `align` (optional): `start` | `center` | `end` (default `center`).
  - `offset` (optional): number of pixels between highlight and bubble (0-64, default `10`).
  - `maxWidth` (optional): max width in px (120-640, default `320`).
  - `theme` (optional): `dark` | `light` (default `dark`).
  - `background` (optional): bubble background CSS color override.
  - `textColor` (optional): bubble text color override.
  - `borderColor` (optional): bubble border color override.
  - `radius` (optional): bubble corner radius in px (0-24, default `12`).
  - `arrow` (optional): `true`/`false` to show the pointer (default `true`).
- `requestId` (optional): client-defined id for tracking.
<!-- Expand highlight parameter docs to include bubble payload fields. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_highlight.mjs \
  --task-group <taskGroupId> \
  --instance app \
  --selector ".page-kicker" \
  --mode outline \
  --color "#ff4d4f" \
  --padding 4 \
  --scroll true \
  --bubble-text "Edit this title" \
  --bubble-placement top \
  --bubble-align center \
  --bubble-offset 12 \
  --bubble-theme dark
```
<!-- Add bubble flag example to highlight CLI sample. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

### 5) Stop preview

**Endpoint**: `POST /api/task-groups/:id/preview/stop`

**Purpose**: Stop preview instances after debugging to free ports and resources.

**Script**: `scripts/preview_stop.mjs`

```bash
node .codex/skills/hookcode-preview-highlight/scripts/preview_stop.mjs \
  --task-group <taskGroupId>
```

## Bridge requirements (must be installed in the preview app)

- Copy `shared/preview-bridge.js` into the preview project and import it in the app entry file.
- The bridge answers a `hookcode:preview:ping` handshake from HookCode. Only after the handshake does the frontend forward highlight commands.
- A highlight API response with `subscribers: 0` usually means the preview UI is not connected or the bridge did not answer the ping.

## Troubleshooting

- **`preview_not_running`** (409): Start the preview first or check the instance name.
- **`selector_required` / `selector_not_found`** (response from bridge): verify the selector exists in the preview DOM.
- **`bubble_text_required`**: a bubble payload was supplied without valid `text`.
- **`fetch failed`**: the backend is unreachable; check `HOOKCODE_API_BASE_URL` and local network access.
- **`subscribers: 0`**: the preview UI is not listening or the bridge script is missing.
<!-- Document bubble-specific error messaging. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

## References

- `references/highlight-protocol.md` for full protocol details and bridge message formats.

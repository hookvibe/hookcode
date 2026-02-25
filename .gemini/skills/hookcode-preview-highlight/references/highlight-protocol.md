# Preview Highlight Protocol Reference
<!-- Document preview highlight protocol details for the skill. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

## HTTP API: POST /api/task-groups/:id/preview/:instance/highlight

### Purpose
Send a DOM highlight command to the preview iframe bridge for a specific task group + instance.

### Request body
- `selector` (string, required): CSS selector to highlight. The bridge attempts `querySelector` first, then falls back to `querySelectorAll` (preferring visible matches), simple id/class/tag lookups, and open shadow-root scans when needed.
- Selector matcher rules (when CSS selectors are not enough):
  - `text:<value>` or `text=<value>` (match text content, case-insensitive).
  - `attr:<name>=<value>` (match attribute values).
  - `data:<name>=<value>` / `aria:<name>=<value>` (match data-/aria- attributes).
  - `role:<value>` / `testid:<value>` (role or data-testid shorthand).
  - Loose attribute syntax like `data-testid=cta` is also accepted.
<!-- Document selector matcher rules for bridge resolution. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
- `targetUrl` (string, optional): preview URL or path to navigate before highlighting; supports route matching rules like `:param`, `*`, `**`, query/hash wildcards, and `||` alternatives, and the preview UI may auto-navigate unless auto-navigation is locked.
<!-- Document target URL route matching behavior for preview highlights. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
  - `:param` matches a single path segment; `*` matches within a segment; `**` matches across segments.
  - Query matching only enforces params you declare (e.g. `?tab` or `?tab=*`).
  - Hash matching accepts wildcards such as `#section-*`.
  - `||` provides alternate acceptable routes; the first entry is used for navigation when needed.
<!-- Detail targetUrl route matching rules in protocol docs. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
- `padding` (number, optional): Padding in px around the element (0-64, default 4).
- `color` (string, optional): CSS color value for the outline/mask (max length 40).
- `mode` (`outline` | `mask`, optional): Highlight style (default `outline`).
- `scrollIntoView` (boolean, optional): Scroll element into view before highlighting (default `false`).
- `bubble` (object, optional): Tooltip bubble payload rendered near the highlight.
  - `text` (string, required when bubble is present): Bubble copy text (1-280 chars).
  - `placement` (`top` | `right` | `bottom` | `left` | `auto`, optional): Preferred bubble placement (default `auto`); auto prefers bottom/top and flips away from clipped edges.
<!-- Document bubble placement flip behavior for preview tooltips. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->
  - `align` (`start` | `center` | `end`, optional): Alignment along the target edge (default `center`).
  - `offset` (number, optional): Gap in px between highlight and bubble (0-64, default 10).
  - `maxWidth` (number, optional): Max bubble width in px (120-640, default 320).
  - `theme` (`dark` | `light`, optional): Theme preset (default `dark`).
  - `background` (string, optional): CSS background override.
  - `textColor` (string, optional): CSS text color override.
  - `borderColor` (string, optional): CSS border color override.
  - `radius` (number, optional): Corner radius in px (0-24, default 12).
  - `arrow` (boolean, optional): Show the bubble arrow pointer (default true).
- `requestId` (string, optional): Client-supplied request id for tracking.
<!-- Add bubble payload fields to highlight protocol docs. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

### Response body
- `success` (boolean): Whether the command was published.
- `requestId` (string): Request id used by the backend.
- `subscribers` (number): Number of live SSE subscribers receiving the command.
- `targetUrl` (string, optional): Echo of the requested target URL (useful for debugging).
<!-- Document target URL echo in highlight responses. docs/en/developer/plans/previewhighlightselector20260204/task_plan.md previewhighlightselector20260204 -->

### Common errors
- `404 Preview instance not found`: invalid task group or instance name.
- `409 preview_not_running`: preview instance is not running or starting.
- `400` validation errors: invalid selector, padding out of range, or mode not in `outline|mask`.
- `bubble_text_required`: bubble payload present without valid `text`.
<!-- Document bubble-specific error responses. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

## Bridge message types (postMessage)

These are handled by `shared/preview-bridge.js` inside the previewed app:

- `hookcode:preview:ping` → bridge replies with `hookcode:preview:pong`
- `hookcode:preview:highlight` → bridge applies highlight and replies with `hookcode:preview:response`
- `hookcode:preview:clear` → bridge clears highlight and replies with `hookcode:preview:response`

### Highlight payload fields
- `selector` (string, required)
- `padding`, `color`, `mode`, `scrollIntoView` (optional)
- `bubble` (optional)
- `requestId` (string, optional)
<!-- Extend bridge payload docs for bubble option. docs/en/developer/plans/jemhyxnaw3lt4qbxtr48/task_plan.md jemhyxnaw3lt4qbxtr48 -->

### Response payload fields
- `ok` (boolean)
- `error` (string | undefined)
- `requestId` (string | undefined)

## Runtime behavior

- The backend emits highlight events over SSE by topic `preview-highlight:<taskGroupId>`.
- The HookCode frontend listens to SSE and forwards the command into the preview iframe via `postMessage`.
- Highlights only render if the preview app has loaded the bridge script and answered the handshake ping.

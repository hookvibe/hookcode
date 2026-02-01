# Preview Highlight Protocol Reference
<!-- Document preview highlight protocol details for the skill. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as -->

## HTTP API: POST /api/task-groups/:id/preview/:instance/highlight

### Purpose
Send a DOM highlight command to the preview iframe bridge for a specific task group + instance.

### Request body
- `selector` (string, required): CSS selector to highlight.
- `padding` (number, optional): Padding in px around the element. Range is validated on the backend.
- `color` (string, optional): CSS color value for the outline/mask.
- `mode` (`outline` | `mask`, optional): Highlight style.
- `scrollIntoView` (boolean, optional): Scroll element into view before highlighting.
- `requestId` (string, optional): Client-supplied request id for tracking.

### Response body
- `success` (boolean): Whether the command was published.
- `requestId` (string): Request id used by the backend.
- `subscribers` (number): Number of live SSE subscribers receiving the command.

### Common errors
- `404 Preview instance not found`: invalid task group or instance name.
- `409 preview_not_running`: preview instance is not running or starting.
- `400` validation errors: invalid selector, padding out of range, or mode not in `outline|mask`.

## Bridge message types (postMessage)

These are handled by `shared/preview-bridge.js` inside the previewed app:

- `hookcode:preview:ping` → bridge replies with `hookcode:preview:pong`
- `hookcode:preview:highlight` → bridge applies highlight and replies with `hookcode:preview:response`
- `hookcode:preview:clear` → bridge clears highlight and replies with `hookcode:preview:response`

### Highlight payload fields
- `selector` (string, required)
- `padding`, `color`, `mode`, `scrollIntoView` (optional)
- `requestId` (string, optional)

### Response payload fields
- `ok` (boolean)
- `error` (string | undefined)
- `requestId` (string | undefined)

## Runtime behavior

- The backend emits highlight events over SSE by topic `preview-highlight:<taskGroupId>`.
- The HookCode frontend listens to SSE and forwards the command into the preview iframe via `postMessage`.
- Highlights only render if the preview app has loaded the bridge script and answered the handshake ping.

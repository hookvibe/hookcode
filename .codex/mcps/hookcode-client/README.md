<!-- Usage notes for the MCP client helper script. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2 -->
# HookCode MCP Client (HTTP)

This folder contains a minimal MCP HTTP client script for calling the backend MCP server locally.

## Environment Variables

- `MCP_SERVER_URL`: MCP server URL (default `http://127.0.0.1:7350/mcp`)
- `MCP_AUTH_TOKEN`: auth token (sent as `Authorization: Bearer <token>`)
- `MCP_AUTH_HEADER`: auth header type (`authorization` or `x-hookcode-token`)
- `MCP_PROTOCOL_VERSION`: protocol version (default `2025-11-25`)
- `MCP_CLIENT_NAME`: client name (default `hookcode-mcp-client`)
- `MCP_CLIENT_VERSION`: client version (default `0.1.0`)

## Example

```bash
MCP_AUTH_TOKEN=YOUR_TOKEN node .codex/mcp-client/client.js tasks.list '{"limit":10}'
```

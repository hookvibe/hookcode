#!/usr/bin/env node
// Minimal MCP HTTP client for HookCode backend tools. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2

const serverUrl = process.env.MCP_SERVER_URL || 'http://127.0.0.1:7350/mcp';
const token = process.env.MCP_AUTH_TOKEN || '';
const authHeader = (process.env.MCP_AUTH_HEADER || 'authorization').toLowerCase();
const protocolVersion = process.env.MCP_PROTOCOL_VERSION || '2025-11-25';
const clientName = process.env.MCP_CLIENT_NAME || 'hookcode-mcp-client';
const clientVersion = process.env.MCP_CLIENT_VERSION || '0.1.0';

const toolName = process.argv[2];
const rawArgs = process.argv[3];

if (!toolName) {
  console.error('Usage: MCP_AUTH_TOKEN=... node .codex/mcp-client/client.js <toolName> [jsonArgs]');
  process.exit(1);
}

const parseArgs = () => {
  if (!rawArgs) return {};
  try {
    return JSON.parse(rawArgs);
  } catch (error) {
    console.error('Invalid JSON args. Example: \'{"limit":10}\'');
    process.exit(1);
  }
};

const buildHeaders = (sessionId) => {
  const headers = { 'content-type': 'application/json' };
  if (token) {
    if (authHeader === 'x-hookcode-token') {
      headers['x-hookcode-token'] = token;
    } else {
      headers.authorization = `Bearer ${token}`;
    }
  }
  if (sessionId) headers['mcp-session-id'] = sessionId;
  return headers;
};

const postJson = async (body, sessionId) => {
  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: buildHeaders(sessionId),
    body: JSON.stringify(body)
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
};

const initialize = async () => {
  const initRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion,
      capabilities: {},
      clientInfo: { name: clientName, version: clientVersion }
    }
  };

  const { response, json } = await postJson(initRequest);
  const sessionId = response.headers.get('mcp-session-id');
  if (!sessionId) {
    throw new Error('Missing mcp-session-id in initialize response.');
  }
  return { sessionId, initResult: json };
};

const sendInitialized = async (sessionId) => {
  const initializedNotification = {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
  };
  await postJson(initializedNotification, sessionId);
};

const callTool = async (sessionId) => {
  const toolRequest = {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: parseArgs()
    }
  };

  const { json } = await postJson(toolRequest, sessionId);
  return json;
};

const main = async () => {
  const { sessionId, initResult } = await initialize();
  await sendInitialized(sessionId);
  const result = await callTool(sessionId);
  console.log(JSON.stringify({ init: initResult, result }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Unknown error');
  process.exit(1);
});

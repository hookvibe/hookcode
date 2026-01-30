import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types';
import type { Request, Response } from 'express';
import { createMcpAuthMiddleware } from './auth';
import { requestBackend } from './backendClient';
import { loadMcpServerConfig } from './config';
import { backendToolDefinitions } from './toolRegistry';

const config = loadMcpServerConfig();
const app = createMcpExpressApp({ host: config.host, allowedHosts: config.allowedHosts });
const authMiddleware = createMcpAuthMiddleware(config);

const transports: Record<string, StreamableHTTPServerTransport> = {};

const getSessionId = (req: Request): string | undefined => {
  const raw = req.header('mcp-session-id');
  return raw ? raw.trim() : undefined;
};

// Cast Express requests for MCP transport auth typing compatibility. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const toTransportRequest = (req: Request): IncomingMessage & { auth?: AuthInfo } =>
  req as unknown as IncomingMessage & { auth?: AuthInfo };

// Normalize tool responses into text content blocks for MCP clients. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const toTextContent = (text: string) => [{ type: 'text' as const, text }];

// Register backend proxy tools on each MCP server instance. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const buildServer = () => {
  const server = new McpServer(
    {
      name: 'hookcode-backend-mcp',
      version: '0.1.0'
    },
    { capabilities: { logging: {} } }
  );

  for (const tool of backendToolDefinitions) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema
      },
      async (input: unknown, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        try {
          const response = await requestBackend(config, tool.buildRequest(input as never), extra?.authInfo?.token);
          return {
            content: toTextContent(
              JSON.stringify(
                {
                  ok: response.ok,
                  status: response.status,
                  data: response.data
                },
                null,
                2
              )
            ),
            isError: !response.ok
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Backend request failed.';
          return {
            content: toTextContent(JSON.stringify({ ok: false, status: 0, error: message }, null, 2)),
            isError: true
          };
        }
      }
    );
  }

  return server;
};

// Serve MCP Streamable HTTP endpoints backed by HookCode REST APIs. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const handlePost = async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);

  try {
    let transport: StreamableHTTPServerTransport | undefined;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: config.enableJsonResponse,
        onsessioninitialized: (sid) => {
          transports[sid] = transport as StreamableHTTPServerTransport;
        }
      });

      transport.onclose = () => {
        const sid = transport?.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
        }
      };

      const server = buildServer();
      await server.connect(transport);
      await transport.handleRequest(toTransportRequest(req), res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null
      });
      return;
    }

    await transport.handleRequest(toTransportRequest(req), res, req.body);
  } catch (error) {
    console.error('[mcp] request failed', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
};

const handleGet = async (req: Request, res: Response) => {
  if (config.enableJsonResponse) {
    res.status(405).set('Allow', 'POST').send('Method Not Allowed');
    return;
  }

  const sessionId = getSessionId(req);
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  try {
    await transports[sessionId].handleRequest(toTransportRequest(req), res);
  } catch (error) {
    console.error('[mcp] SSE request failed', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

const handleDelete = async (req: Request, res: Response) => {
  const sessionId = getSessionId(req);
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  try {
    await transports[sessionId].handleRequest(toTransportRequest(req), res);
  } catch (error) {
    console.error('[mcp] session termination failed', error);
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
};

app.post('/mcp', authMiddleware, handlePost);
app.get('/mcp', authMiddleware, handleGet);
app.delete('/mcp', authMiddleware, handleDelete);

// Start MCP HTTP server and surface startup errors. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const httpServer = app.listen(config.port, config.host, () => {
  console.log(`[mcp] listening on http://${config.host}:${config.port}/mcp`);
});

httpServer.on('error', (error) => {
  console.error('[mcp] failed to start', error);
  process.exit(1);
});

// Cleanly close MCP transports on shutdown signals. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
const shutdown = async () => {
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId].close();
    } catch (error) {
      console.error(`[mcp] transport close failed for ${sessionId}`, error);
    } finally {
      delete transports[sessionId];
    }
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

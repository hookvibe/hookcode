import type { NextFunction, Request, Response } from 'express';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types';
import { extractAuthToken } from '../modules/auth/authToken';
import type { McpServerConfig } from './config';

const buildAuthInfo = (token: string): AuthInfo => ({
  token,
  clientId: 'hookcode-mcp-client',
  scopes: [],
  extra: { source: 'header' }
});

// Attach MCP auth info from headers to each request without logging secrets. docs/en/developer/plans/z4xn4m8yue7jxh9jv1p2/task_plan.md z4xn4m8yue7jxh9jv1p2
export const createMcpAuthMiddleware = (config: McpServerConfig) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractAuthToken(req, { allowQueryToken: false });
    if (!token) {
      if (config.authRequired) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Missing MCP auth token.' });
      }
      return next();
    }

    const reqWithAuth = req as unknown as { auth?: AuthInfo };
    reqWithAuth.auth = buildAuthInfo(token);
    return next();
  };
};

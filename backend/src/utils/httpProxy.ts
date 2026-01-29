import http from 'http';
import https from 'https';
import type { Request, Response } from 'express';

export interface ProxyHttpRequestOptions {
  upstreamOrigin: string;
  rawUrl?: string;
  rewritePath?: (path: string) => string;
  rewriteHtml?: (html: string) => string;
  rewriteLocation?: (value: string) => string;
  logTag?: string;
}

export const proxyHttpRequest = (req: Request, res: Response, options: ProxyHttpRequestOptions): void => {
  // Proxy an HTTP request with optional path/HTML/header rewriting. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
  const rawUrl = options.rawUrl ?? req.originalUrl ?? req.url ?? '/';
  const parsed = new URL(rawUrl, 'http://local');
  const rewrittenPath = options.rewritePath ? options.rewritePath(parsed.pathname) : parsed.pathname;
  const normalizedPath = rewrittenPath && rewrittenPath.startsWith('/') ? rewrittenPath : `/${rewrittenPath || ''}`;
  const upstreamUrl = new URL(`${normalizedPath}${parsed.search}`, options.upstreamOrigin);

  const headers = { ...req.headers } as Record<string, any>;
  headers.host = upstreamUrl.host;
  if (options.rewriteHtml) {
    headers['accept-encoding'] = 'identity';
  }

  const client = upstreamUrl.protocol === 'https:' ? https : http;

  const proxyReq = client.request(
    upstreamUrl,
    {
      method: req.method,
      headers
    },
    (proxyRes) => {
      const status = proxyRes.statusCode || 502;
      const contentType = String(proxyRes.headers['content-type'] ?? '');
      const isHtml = Boolean(options.rewriteHtml) && contentType.includes('text/html');

      res.status(status);

      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value === undefined) continue;
        const lower = key.toLowerCase();
        if (lower === 'location' && typeof value === 'string' && options.rewriteLocation) {
          res.setHeader(key, options.rewriteLocation(value));
          continue;
        }
        if (isHtml && (lower === 'content-length' || lower === 'content-encoding')) continue;
        res.setHeader(key, value as any);
      }

      if (!isHtml) {
        proxyRes.pipe(res);
        return;
      }

      const chunks: Buffer[] = [];
      proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
      proxyRes.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        const rewritten = options.rewriteHtml ? options.rewriteHtml(raw) : raw;
        res.setHeader('content-length', Buffer.byteLength(rewritten, 'utf8'));
        res.send(rewritten);
      });
    }
  );

  proxyReq.on('error', (err) => {
    const tag = options.logTag ?? '[proxy]';
    console.error(`${tag} proxy error`, err);
    if (!res.headersSent) {
      res.status(502).type('text/plain; charset=utf-8').send('Bad Gateway');
    } else {
      res.end();
    }
  });

  req.pipe(proxyReq);
};

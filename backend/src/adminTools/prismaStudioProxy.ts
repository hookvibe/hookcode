import http, { type IncomingMessage } from 'http';
import net from 'net';
import express from 'express';
import type { Request } from 'express';
import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import type { Duplex } from 'stream';
import {
  ADMIN_TOOLS_TOKEN_COOKIE_NAME,
  ADMIN_TOOLS_TOKEN_QUERY_KEY,
  type AdminToolsAuthDeps,
  authenticateAdminTools,
  clearAdminToolsAuthCookie,
  setAdminToolsAuthCookie
} from './auth';

const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });

const renderLoginPage = (params: { title: string; message?: string }) => {
  const title = escapeHtml(params.title);
  const message = params.message ? `<p style="color:#dc2626">${escapeHtml(params.message)}</p>` : '';
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; margin: 0; background: #0b1220; color: #e5e7eb; }
      .wrap { max-width: 720px; margin: 10vh auto; padding: 24px; }
      .card { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12); border-radius: 14px; padding: 18px 18px 14px; }
      input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.18); background: rgba(0,0,0,.25); color: #fff; }
      button { margin-top: 10px; padding: 10px 12px; border-radius: 10px; border: 0; background: #1677ff; color: #fff; cursor: pointer; }
      a { color: #93c5fd; }
      .muted { color: #9ca3af; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1 style="margin:0 0 12px">${title}</h1>
      <div class="card">
        ${message}
        <p class="muted">请从 HookCode 控制台“系统工具”打开，或粘贴 token 登录。</p>
        <form method="POST" action="/login">
          <input name="${ADMIN_TOOLS_TOKEN_QUERY_KEY}" placeholder="粘贴 Authorization Bearer token（不含 Bearer 前缀）" />
          <button type="submit">登录</button>
        </form>
      </div>
    </div>
    <script>
      (function () {
        try {
          var key = ${JSON.stringify(ADMIN_TOOLS_TOKEN_QUERY_KEY)};
          var hash = String(window.location.hash || '');
          if (!hash || hash.length < 2) return;
          var raw = hash.slice(1); // remove '#'
          var params = new URLSearchParams(raw);
          var token = (params.get(key) || '').trim();
          if (!token) return;

          // Clear the token from the URL bar as early as possible.
          try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch {}

          var input = document.querySelector('input[name="' + key + '"]');
          if (input) input.value = token;
          var form = document.querySelector('form');
          if (form) form.submit();
        } catch {}
      })();
    </script>
  </body>
</html>`;
};

const rewriteLocationHeader = (location: string, upstreamOrigin: string): string => {
  try {
    const loc = new URL(location, upstreamOrigin);
    const upstream = new URL(upstreamOrigin);
    // Rewrite only absolute redirects within the upstream origin to avoid exposing 127.0.0.1:5555 to the browser.
    if (loc.origin !== upstream.origin) return location;
    return loc.pathname + loc.search + loc.hash;
  } catch {
    return location;
  }
};

const writeSocketUnauthorized = (socket: Duplex) => {
  try {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
  } finally {
    socket.destroy();
  }
};

export const spawnPrismaStudio = async (params: {
  upstreamPort: number;
  hostname?: string;
}): Promise<ChildProcess> => {
  const hostname = params.hostname ?? '127.0.0.1';
  // __dirname:
  // - dev:   backend/src/adminTools
  // - build: backend/dist/adminTools
  // Both cases: go up 2 levels to reach `backend/`.
  const backendRoot = path.resolve(__dirname, '..', '..');
  const prismaRunJs = path.join(backendRoot, 'scripts', 'prisma-run.js');

  const child = spawn(process.execPath, [prismaRunJs, 'studio', '--hostname', hostname, '--port', String(params.upstreamPort), '--browser', 'none'], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit'
  });
  return child;
};

export const createPrismaStudioProxyServer = (params: {
  upstreamPort: number;
  cookieSecure?: boolean;
  cookieName?: string;
  authDeps?: AdminToolsAuthDeps;
}) => {
  const cookieName = params.cookieName ?? ADMIN_TOOLS_TOKEN_COOKIE_NAME;
  const cookieSecure = Boolean(params.cookieSecure);
  const authDeps = params.authDeps;
  if (!authDeps) {
    throw new Error('[admin-tools] missing authDeps for Prisma Studio proxy');
  }
  const upstreamOrigin = `http://127.0.0.1:${params.upstreamPort}`;

  const app = express();

  app.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
    const token =
      typeof (req as any).body?.[ADMIN_TOOLS_TOKEN_QUERY_KEY] === 'string'
        ? String((req as any).body[ADMIN_TOOLS_TOKEN_QUERY_KEY]).trim()
        : '';

    if (!token) {
      return res.status(200).type('text/html; charset=utf-8').send(
        renderLoginPage({
          title: 'HookCode Prisma Studio',
          message: '登录失败：token 不能为空。'
        })
      );
    }

    let payload: any;
    try {
      payload = authDeps.verifyToken(token);
    } catch {
      return res.status(200).type('text/html; charset=utf-8').send(
        renderLoginPage({
          title: 'HookCode Prisma Studio',
          message: '登录失败：token 无效或已过期。'
        })
      );
    }

    const user = await authDeps.getUserById(payload.sub);
    if (!user || user.disabled) {
      return res.status(200).type('text/html; charset=utf-8').send(
        renderLoginPage({
          title: 'HookCode Prisma Studio',
          message: '登录失败：账号无权限或已被禁用。'
        })
      );
    }

    setAdminToolsAuthCookie(res, { token, payload, cookieName, secure: cookieSecure });
    return res.redirect('/');
  });

  app.get('/logout', (_req, res) => {
    clearAdminToolsAuthCookie(res, { cookieName, secure: cookieSecure });
    return res.redirect('/');
  });

  app.use(async (req, res, next) => {
    // Only the root path can show the guide page without login; all other paths require auth (cookie).
    if (req.path !== '/' && req.path !== '') {
      const auth = await authenticateAdminTools(req, authDeps, cookieName);
      if (!auth.ok) return res.status(auth.status).send(auth.error);
    }
    return next();
  });

  app.get('/', async (req, res) => {
    const auth = await authenticateAdminTools(req, authDeps, cookieName);
    if (!auth.ok) {
      return res.status(200).type('text/html; charset=utf-8').send(renderLoginPage({ title: 'HookCode Prisma Studio' }));
    }

    // Authenticated: proxy directly to Prisma Studio.
    return proxyHttpRequest(req, res, upstreamOrigin);
  });

  app.use((req, res) => proxyHttpRequest(req, res, upstreamOrigin));

  const server = http.createServer(app);

  server.on('upgrade', async (req, socket, head) => {
    const fakeReq = {
      header: (name: string) => {
        const v = (req.headers as any)[name.toLowerCase()];
        return Array.isArray(v) ? v.join(',') : v;
      },
      query: Object.fromEntries(new URL(req.url || '/', 'http://local').searchParams.entries()),
      method: req.method,
      path: new URL(req.url || '/', 'http://local').pathname,
      originalUrl: req.url,
      url: req.url
    } as unknown as Request;

    const auth = await authenticateAdminTools(
      fakeReq,
      authDeps,
      cookieName
    );
    if (!auth.ok) return writeSocketUnauthorized(socket);

    const upstreamSocket = net.connect(params.upstreamPort, '127.0.0.1', () => {
      const lines: string[] = [];
      lines.push(`${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/${req.httpVersion}`);
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const v of value) lines.push(`${key}: ${v}`);
        } else {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push('\r\n');
      upstreamSocket.write(lines.join('\r\n'));
      if (head && head.length) upstreamSocket.write(head);
      socket.pipe(upstreamSocket).pipe(socket);
    });

    upstreamSocket.on('error', () => {
      socket.destroy();
    });
  });

  return server;
};

const proxyHttpRequest = (req: Request, res: any, upstreamOrigin: string) => {
  const upstreamUrl = new URL(req.originalUrl || req.url || '/', upstreamOrigin);
  const headers = { ...req.headers } as Record<string, any>;
  headers.host = upstreamUrl.host;

  const proxyReq = http.request(
    upstreamUrl,
    {
      method: req.method,
      headers
    },
    (proxyRes) => {
      const status = proxyRes.statusCode || 502;
      res.status(status);

      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (value === undefined) continue;
        if (key.toLowerCase() === 'location' && typeof value === 'string') {
          res.setHeader(key, rewriteLocationHeader(value, upstreamOrigin));
          continue;
        }
        res.setHeader(key, value as any);
      }

      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', (err) => {
    console.error('[admin-tools][prisma] proxy error', err);
    if (!res.headersSent) {
      res.status(502).type('text/plain; charset=utf-8').send('Bad Gateway');
    } else {
      res.end();
    }
  });

  (req as any as IncomingMessage).pipe(proxyReq);
};

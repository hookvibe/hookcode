import express from 'express';
import type { INestApplication } from '@nestjs/common';
import { createOpenApiSpec } from './openapi';
import {
  ADMIN_TOOLS_TOKEN_QUERY_KEY,
  ADMIN_TOOLS_TOKEN_COOKIE_NAME,
  type AdminToolsAuthDeps,
  authenticateAdminTools,
  clearAdminToolsAuthCookie,
  setAdminToolsAuthCookie
} from './auth';
import { DEFAULT_ADMIN_TOOLS_LOCALE, resolveAdminToolsLocale, type AdminToolsLocale } from './i18n';

const escapeHtml = (input: string): string =>
  input.replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    if (ch === '"') return '&quot;';
    return '&#39;';
  });

const s = (locale: AdminToolsLocale, zh: string, en: string): string => (locale === 'en-US' ? en : zh);

const renderLoginPage = (params: { title: string; locale: AdminToolsLocale; message?: string }) => {
  const title = escapeHtml(params.title);
  const message = params.message ? `<p style="color:#dc2626">${escapeHtml(params.message)}</p>` : '';
  const lang = params.locale;
  const otherLocale = lang === 'en-US' ? 'zh-CN' : 'en-US';
  const otherLabel = lang === 'en-US' ? '中文' : 'English';
  const actionUrl = `/login?lang=${encodeURIComponent(lang)}`;
  return `<!doctype html>
<html lang="${lang}">
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
      <div style="margin: 0 0 12px">
        <a href="/?lang=${encodeURIComponent(otherLocale)}" style="color:#93c5fd;text-decoration:none">${otherLabel}</a>
      </div>
      <div class="card">
        ${message}
        <p class="muted">${escapeHtml(
          s(lang, '请从 HookCode 控制台“系统工具”打开，或粘贴 token 登录。', 'Open from HookCode Console → System Tools, or paste a token to sign in.')
        )}</p>
        <form method="POST" action="${actionUrl}">
          <input name="${ADMIN_TOOLS_TOKEN_QUERY_KEY}" placeholder="${escapeHtml(
            s(lang, '粘贴 Authorization Bearer token（不含 Bearer 前缀）', "Paste Authorization Bearer token (without the 'Bearer' prefix)")
          )}" />
          <button type="submit">${escapeHtml(s(lang, '登录', 'Sign in'))}</button>
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

const renderSwaggerUiPage = (params: {
  title: string;
  locale: AdminToolsLocale;
  specUrl: string;
  apiBaseUrl: string;
  token: string;
}) => {
  const title = escapeHtml(params.title);
  const token = JSON.stringify(params.token);
  const specUrl = JSON.stringify(params.specUrl);
  const apiBaseUrl = escapeHtml(params.apiBaseUrl);
  const lang = params.locale;
  const otherLocale = lang === 'en-US' ? 'zh-CN' : 'en-US';
  const otherLabel = lang === 'en-US' ? '中文' : 'English';

  // Note: Swagger UI assets are loaded from a CDN (swagger-ui-dist). If the deployment environment disallows outbound internet, host them locally.
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css" />
    <style>
      body { margin: 0; }
      .topbar { display: none; }
      .ai-tools-bar { padding: 10px 14px; background: #0b1220; color: #e5e7eb; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
      .ai-tools-bar a { color: #93c5fd; text-decoration: none; }
      .ai-tools-bar code { background: rgba(255,255,255,.08); padding: 2px 6px; border-radius: 8px; }
    </style>
  </head>
  <body>
    <div class="ai-tools-bar">
      Swagger · ${escapeHtml(s(lang, 'API Base', 'API Base'))}: <code>${apiBaseUrl}</code> ·
      <a href="/?lang=${encodeURIComponent(otherLocale)}">${otherLabel}</a> ·
      <a href="/logout?lang=${encodeURIComponent(lang)}">${escapeHtml(s(lang, '退出', 'Sign out'))}</a>
    </div>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = function () {
        const token = ${token};
        const ui = SwaggerUIBundle({
          url: ${specUrl},
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'BaseLayout',
          requestInterceptor: (req) => {
            try {
              req.headers = req.headers || {};
              if (!req.headers['Authorization'] && token) {
                req.headers['Authorization'] = 'Bearer ' + token;
              }
            } catch {}
            return req;
          }
        });
        window.ui = ui;
      };
    </script>
  </body>
</html>`;
};

export const createSwaggerApp = (params: {
  apiBaseUrl: string;
  cookieSecure?: boolean;
  cookieName?: string;
  authDeps?: AdminToolsAuthDeps;
  nestApp: INestApplication;
}) => {
  const cookieName = params.cookieName ?? ADMIN_TOOLS_TOKEN_COOKIE_NAME;
  const cookieSecure = Boolean(params.cookieSecure);
  const authDeps = params.authDeps;
  if (!authDeps) {
    throw new Error('[admin-tools] missing authDeps for Swagger app');
  }
  const zhSpec = createOpenApiSpec({ apiBaseUrl: params.apiBaseUrl, locale: 'zh-CN', app: params.nestApp });
  const enSpec = createOpenApiSpec({ apiBaseUrl: params.apiBaseUrl, locale: 'en-US', app: params.nestApp });

  const app = express();

  app.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
    const locale = resolveAdminToolsLocale({
      queryLang: (req as any)?.query?.lang,
      acceptLanguage: req.header('accept-language'),
      fallback: DEFAULT_ADMIN_TOOLS_LOCALE
    });
    const token =
      typeof (req as any).body?.[ADMIN_TOOLS_TOKEN_QUERY_KEY] === 'string'
        ? String((req as any).body[ADMIN_TOOLS_TOKEN_QUERY_KEY]).trim()
        : '';

    if (!token) {
      return res.status(200).type('text/html; charset=utf-8').send(
        renderLoginPage({
          title: s(locale, 'HookCode Swagger', 'HookCode Swagger'),
          locale,
          message: s(locale, '登录失败：token 不能为空。', 'Sign-in failed: token is required.')
        })
      );
    }

    let payload: any;
    try {
      payload = authDeps.verifyToken(token);
    } catch {
      return res.status(200).type('text/html; charset=utf-8').send(
        renderLoginPage({
          title: s(locale, 'HookCode Swagger', 'HookCode Swagger'),
          locale,
          message: s(locale, '登录失败：token 无效或已过期。', 'Sign-in failed: token is invalid or expired.')
        })
      );
    }

    const user = await authDeps.getUserById(payload.sub);
    if (!user || user.disabled) {
      return res.status(200).type('text/html; charset=utf-8').send(
        renderLoginPage({
          title: s(locale, 'HookCode Swagger', 'HookCode Swagger'),
          locale,
          message: s(locale, '登录失败：账号无权限或已被禁用。', 'Sign-in failed: account has no access or is disabled.')
        })
      );
    }

    setAdminToolsAuthCookie(res, { token, payload, cookieName, secure: cookieSecure });
    return res.redirect(`/?lang=${encodeURIComponent(locale)}`);
  });

  app.get('/logout', (_req, res) => {
    const locale = resolveAdminToolsLocale({
      queryLang: (_req as any)?.query?.lang,
      acceptLanguage: _req.header('accept-language'),
      fallback: DEFAULT_ADMIN_TOOLS_LOCALE
    });
    clearAdminToolsAuthCookie(res, { cookieName, secure: cookieSecure });
    return res.redirect(`/?lang=${encodeURIComponent(locale)}`);
  });

  app.get('/openapi.json', async (req, res) => {
    const locale = resolveAdminToolsLocale({
      queryLang: (req as any)?.query?.lang,
      acceptLanguage: req.header('accept-language'),
      fallback: DEFAULT_ADMIN_TOOLS_LOCALE
    });
    const auth = await authenticateAdminTools(req, authDeps, cookieName);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error, message: auth.message });
    }
    return res.json(locale === 'en-US' ? enSpec : zhSpec);
  });

  app.get('/', async (req, res) => {
    const locale = resolveAdminToolsLocale({
      queryLang: (req as any)?.query?.lang,
      acceptLanguage: req.header('accept-language'),
      fallback: DEFAULT_ADMIN_TOOLS_LOCALE
    });
    const auth = await authenticateAdminTools(req, authDeps, cookieName);
    if (!auth.ok) {
      return res
        .status(200)
        .type('text/html; charset=utf-8')
        .send(renderLoginPage({ title: s(locale, 'HookCode Swagger', 'HookCode Swagger'), locale }));
    }

    return res
      .status(200)
      .type('text/html; charset=utf-8')
      .send(
        renderSwaggerUiPage({
          title: s(locale, 'HookCode Swagger', 'HookCode Swagger'),
          locale,
          specUrl: `/openapi.json?lang=${encodeURIComponent(locale)}`,
          apiBaseUrl: params.apiBaseUrl,
          token: auth.ctx.token
        })
      );
  });

  return app;
};

import { PreviewProxyController } from '../../modules/tasks/preview-proxy.controller';

// Validate preview proxy prefix derivation for HTML rewrites. docs/en/developer/plans/3ldcl6h5d61xj2hsu6as/task_plan.md 3ldcl6h5d61xj2hsu6as
describe('PreviewProxyController', () => {
  test('derives prefix from originalUrl with api base', () => {
    const controller = new PreviewProxyController({} as any);
    const req = {
      originalUrl: '/api/preview/group-1/app/@vite/client',
      url: '/group-1/app/@vite/client'
    } as any;
    const prefix = (controller as any).resolvePreviewPrefix(req, 'group-1', 'app');
    expect(prefix).toBe('/api/preview/group-1/app');
  });

  test('falls back to url when originalUrl is missing', () => {
    const controller = new PreviewProxyController({} as any);
    const req = {
      url: '/preview/group-2/app/'
    } as any;
    const prefix = (controller as any).resolvePreviewPrefix(req, 'group-2', 'app');
    expect(prefix).toBe('/preview/group-2/app');
  });

  test('strips api preview prefix from asset paths', () => {
    const controller = new PreviewProxyController({} as any);
    const path = (controller as any).stripPreviewPrefix(
      '/api/preview/group-1/app/src/main.tsx',
      '/api/preview/group-1/app',
      'group-1',
      'app'
    );
    expect(path).toBe('/src/main.tsx');
  });

  test('falls back to instance prefix stripping when api prefix missing', () => {
    const controller = new PreviewProxyController({} as any);
    const path = (controller as any).stripPreviewPrefix(
      '/group-2/app/@vite/client',
      '/api/preview/group-2/app',
      'group-2',
      'app'
    );
    expect(path).toBe('/@vite/client');
  });

  test('rewrites inline module paths with preview prefix', () => {
    const controller = new PreviewProxyController({} as any);
    const html = 'import "/@react-refresh";';
    const rewritten = (controller as any).rewritePreviewText(html, '/api/preview/group-3/app');
    expect(rewritten).toBe('import "/api/preview/group-3/app/@react-refresh";');
  });

  test('avoids double prefixing preview paths', () => {
    const controller = new PreviewProxyController({} as any);
    const html = 'import "/api/preview/group-3/app/@vite/client";';
    const rewritten = (controller as any).rewritePreviewText(html, '/api/preview/group-3/app');
    expect(rewritten).toBe('import "/api/preview/group-3/app/@vite/client";');
  });

  test('avoids double prefixing base href', () => {
    const controller = new PreviewProxyController({} as any);
    const html = '<head></head>';
    const rewritten = (controller as any).rewritePreviewHtml(html, '/api/preview/group-4/app');
    expect(rewritten).toContain('<base href="/api/preview/group-4/app/" />');
    expect(rewritten).not.toContain('/api/preview/group-4/app/api/preview/group-4/app/');
  });
});

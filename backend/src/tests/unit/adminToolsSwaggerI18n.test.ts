export {};

import { Test } from '@nestjs/testing';
import { resolveAdminToolsLocale } from '../../adminTools/i18n';
import { createOpenApiSpec } from '../../adminTools/openapi';
import { HealthController } from '../../modules/health/health.controller';

describe('Admin Tools（Swagger i18n）', () => {
  test('resolveAdminToolsLocale：query.lang 优先生效', () => {
    expect(resolveAdminToolsLocale({ queryLang: 'en' })).toBe('en-US');
    expect(resolveAdminToolsLocale({ queryLang: 'en-US' })).toBe('en-US');
    expect(resolveAdminToolsLocale({ queryLang: 'zh' })).toBe('zh-CN');
    expect(resolveAdminToolsLocale({ queryLang: 'zh-CN' })).toBe('zh-CN');
    expect(resolveAdminToolsLocale({ queryLang: 'cn' })).toBe('zh-CN');
  });

  test('resolveAdminToolsLocale：可从 Accept-Language 推断', () => {
    expect(resolveAdminToolsLocale({ acceptLanguage: 'en-US,en;q=0.9,zh-CN;q=0.8' })).toBe('en-US');
    expect(resolveAdminToolsLocale({ acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8' })).toBe('zh-CN');
  });

  test('createOpenApiSpec：支持 en-US/zh-CN 两种语言', async () => {
    const mod = await Test.createTestingModule({ controllers: [HealthController] }).compile();
    const app = mod.createNestApplication();

    const zh = createOpenApiSpec({ apiBaseUrl: 'http://example.com/api', locale: 'zh-CN', app }) as any;
    expect(zh.info?.description).toContain('后端 API');
    expect(zh.paths?.['/health']?.get?.summary).toBe('健康检查');

    const en = createOpenApiSpec({ apiBaseUrl: 'http://example.com/api', locale: 'en-US', app }) as any;
    expect(en.info?.description).toContain('backend API');
    expect(en.paths?.['/health']?.get?.summary).toBe('Health check');

    await app.close();
  });
});

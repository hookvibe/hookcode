import { ServiceUnavailableException } from '@nestjs/common';
import { OpenApiController } from '../../modules/openapi/openapi.controller';
import { OpenApiSpecStore } from '../../modules/openapi/openapi-spec.store';

// Verify OpenAPI controller behavior for docs spec loading. docs/en/developer/plans/pixeldocs20260126/task_plan.md pixeldocs20260126
describe('OpenApiController', () => {
  const makeReq = (lang?: string, acceptLanguage?: string) =>
    ({
      query: lang ? { lang } : {},
      header: (key: string) => (key === 'accept-language' ? acceptLanguage : undefined)
    }) as any;

  it('returns the requested locale spec', () => {
    const store = new OpenApiSpecStore();
    const enSpec = { openapi: '3.0.0', info: { title: 'en' } };
    const zhSpec = { openapi: '3.0.0', info: { title: 'zh' } };
    store.setSpec('en-US', enSpec);
    store.setSpec('zh-CN', zhSpec);

    const controller = new OpenApiController(store);
    expect(controller.getSpec(makeReq('en-US'))).toEqual(enSpec);
    expect(controller.getSpec(makeReq(undefined, 'zh-CN'))).toEqual(zhSpec);
  });

  it('throws when the spec is not ready', () => {
    const controller = new OpenApiController(new OpenApiSpecStore());
    expect(() => controller.getSpec(makeReq('en-US'))).toThrow(ServiceUnavailableException);
  });
});

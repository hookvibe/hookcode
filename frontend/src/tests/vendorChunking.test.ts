import { describe, expect, test } from 'vitest';
import { getVendorChunkName } from '../utils/vendorChunking';

describe('getVendorChunkName', () => {
  test('keeps scheduler in the primary vendor chunk to avoid React runtime split cycles', () => {
    // Lock the scheduler-to-vendor mapping so future chunking changes do not reintroduce the dist-only hook crash. docs/en/developer/plans/frontenddistuselayoutfix20260319/task_plan.md frontenddistuselayoutfix20260319
    expect(getVendorChunkName('/workspace/frontend/node_modules/.pnpm/scheduler@0.23.2/node_modules/scheduler/index.js')).toBe('vendor');
  });

  test('keeps unrelated shared dependencies in the same primary vendor chunk', () => {
    expect(getVendorChunkName('/workspace/frontend/node_modules/.pnpm/dayjs@1.11.13/node_modules/dayjs/dayjs.min.js')).toBe('vendor');
  });

  test('keeps large isolated chart dependencies split out', () => {
    expect(getVendorChunkName('/workspace/frontend/node_modules/.pnpm/echarts@5.5.0/node_modules/echarts/index.js')).toBe('vendor-charts');
  });

  test('does not force app source files into vendor chunks', () => {
    expect(getVendorChunkName('/workspace/frontend/src/App.tsx')).toBeUndefined();
  });
});

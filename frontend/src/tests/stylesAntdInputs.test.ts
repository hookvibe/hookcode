// Regression test: prevent AntD affix-wrapper inputs from rendering a double border (wrapper + nested input).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('styles Ant Design input overrides', () => {
  test('removes nested input border inside affix wrappers', () => {
    // Read AntD override module directly after splitting global styles. docs/en/developer/plans/split-long-files-20260203/task_plan.md split-long-files-20260203
    const cssText = readFileSync(resolve(process.cwd(), 'src/styles/antd-overrides.css'), 'utf8');

    // Style contract:
    // - The border + focus ring live on `.ant-input-affix-wrapper`.
    // - The nested `.ant-input` must be fully borderless to avoid a 2-layer border look.
    expect(cssText).toMatch(
      /\.hc-shell\s+\.ant-input-affix-wrapper:not\(\.ant-input-borderless\)\s+\.ant-input\s*\{[\s\S]*?border:\s*none\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;[\s\S]*?\}/
    );

    // Style contract:
    // - Inputs should use the shared control surface token, so the look stays consistent across pages and themes.
    expect(cssText).toMatch(/\.hc-shell\s+\.ant-input:not\(\.ant-input-borderless\)[\s\S]*?background:\s*var\(--hc-control-bg\)/);

    // Style contract:
    // - Inputs must not rely on inset shadows for borders; otherwise some browsers/themes show a "double border".
    expect(cssText).toMatch(/\.hc-shell\s+\.ant-input-affix-wrapper:not\(\.ant-input-borderless\)[\s\S]*?box-shadow:\s*none;/);
  });
});

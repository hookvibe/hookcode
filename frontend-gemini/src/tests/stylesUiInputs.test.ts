// Regression test: prevent UI kit affix-wrapper inputs from rendering a double border (wrapper + nested input). docs/en/developer/plans/frontendgemini-migration-20260127/task_plan.md frontendgemini-migration-20260127
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

describe('styles.css UI input overrides', () => {
  test('removes nested input border inside affix wrappers', () => {
    const cssText = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

    // Style contract:
    // - The border + focus ring live on `.hc-ui-input-affix-wrapper`.
    // - The nested `.hc-ui-input` must be fully borderless to avoid a 2-layer border look.
    expect(cssText).toMatch(
      /\.hc-shell\s+\.hc-ui-input-affix-wrapper:not\(\.hc-ui-input-borderless\)\s+\.hc-ui-input\s*\{[\s\S]*?border:\s*none\s*!important;[\s\S]*?box-shadow:\s*none\s*!important;[\s\S]*?\}/
    );

    // Style contract:
    // - Inputs should use the shared control surface token, so the look stays consistent across pages and themes.
    expect(cssText).toMatch(/\.hc-shell\s+\.hc-ui-input:not\(\.hc-ui-input-borderless\)[\s\S]*?background:\s*var\(--hc-control-bg\)/);

    // Style contract:
    // - Inputs must not rely on inset shadows for borders; otherwise some browsers/themes show a "double border".
    expect(cssText).toMatch(/\.hc-shell\s+\.hc-ui-input-affix-wrapper:not\(\.hc-ui-input-borderless\)[\s\S]*?box-shadow:\s*none;/);
  });
});
